# Presentation Advice: Continuation & State Machines (15 min)

**Core thesis**: Program execution is just a series of "what to do next" — Continuation makes that explicit. State machines give those pause points names and rules.

**Angle**: Use Kotlin Coroutines as the primary vehicle. They are the cleanest bridge between the abstract concept (Continuation) and a real engineering tool students can use tomorrow. Structured Concurrency is the state-machine story told at the scope level.

---

## Narrative Arc

```
Life metaphor (bookmark)
    ↓
What is a Continuation? (conceptual)
    ↓
Kotlin suspends a coroutine → where does it go? (concrete)
    ↓
TCP as a classic state machine (familiar ground)
    ↓
Coroutine state machine (what the compiler actually emits)
    ↓
Structured Concurrency = state machine over a scope tree
    ↓
One-line summary
```

---

## Segment 1 — The Bookmark (1 min)

You're reading a book. Someone calls you for dinner. You put in a bookmark and leave.

- The bookmark is not a page number. It's your **entire context**: page, line, train of thought, what you were going to do next.
- That's a **Continuation** — the reification of "everything that needs to happen from this point forward."

Contrast with a normal function call: the call stack *implicitly* holds your continuation. Kotlin coroutines make it *explicit*, *heap-allocated*, and *first-class*.

---

## Segment 2 — Kotlin Coroutines: Suspension as Continuation Capture (4 min)

### The key mental model

```kotlin
suspend fun loadGame(id: String): Game {
    val metadata = fetchMetadata(id)   // suspend point A
    val cover    = fetchCover(id)      // suspend point B
    return Game(metadata, cover)
}
```

When the coroutine hits `fetchMetadata`, the Kotlin runtime:
1. **Captures** the current continuation (local variables, next instruction pointer)
2. **Stores** it in a heap-allocated `Continuation<Game>` object
3. **Returns** the thread to the pool — the thread is now free
4. When the result arrives: **resumes** by calling `continuation.resumeWith(result)`

The thread is not blocked. The *computation* is paused.

### What `Continuation<T>` actually is

```kotlin
// From Kotlin stdlib — this is the real interface
interface Continuation<in T> {
    val context: CoroutineContext
    fun resumeWith(result: Result<T>)
}
```

`resumeWith` is literally "here is the value, now continue from where you stopped."

### The compiler does CPS for you

Under the hood, the compiler rewrites every `suspend fun` into a state machine. You write:
```kotlin
val metadata = fetchMetadata(id)
val cover    = fetchCover(id)
return Game(metadata, cover)
```

The compiler produces something like:
```kotlin
// Pseudocode of what the compiler emits
fun loadGame(id: String, continuation: Continuation<Game>): Any {
    val sm = continuation as? LoadGameStateMachine ?: LoadGameStateMachine(continuation)
    when (sm.label) {
        0 -> {
            sm.label = 1
            val r = fetchMetadata(id, sm)   // pass sm as the continuation
            if (r == COROUTINE_SUSPENDED) return COROUTINE_SUSPENDED
            sm.metadata = r as Metadata
            // fall through
        }
        1 -> {
            sm.metadata = sm.result as Metadata
            sm.label = 2
            val r = fetchCover(id, sm)
            if (r == COROUTINE_SUSPENDED) return COROUTINE_SUSPENDED
            sm.cover = r as Cover
        }
        2 -> {
            return Game(sm.metadata, sm.cover)
        }
    }
}
```

**This is the state machine.** `sm.label` is the state. Each `suspend` point is a state transition. The Continuation object *is* the state machine instance.

### Key insight to land here

> A `suspend fun` is syntactic sugar over an explicit state machine where each `await` point is a state, and `resumeWith` is the transition trigger.

---

## Segment 3 — TCP as Familiar Ground (2 min)

Before going further, anchor state machines with something everyone knows:

```
CLOSED --[SYN sent]--> SYN_SENT --[SYN+ACK received]--> ESTABLISHED
ESTABLISHED --[FIN sent]--> FIN_WAIT_1 --> FIN_WAIT_2 --> TIME_WAIT --> CLOSED
```

State machine properties:
- **States**: named pause points, each with its own "what am I waiting for"
- **Transitions**: triggered by events (packets received/sent)
- **Persistable**: you can crash and recover because the state is explicit and storable

Then pivot: the Kotlin coroutine compiler emits *exactly* this structure for every `suspend fun`. The difference is that TCP's state machine is hand-written by protocol designers; Kotlin's is generated automatically from your sequential-looking code.

---

## Segment 4 — Structured Concurrency: State Machines Over a Tree (4 min)

### The problem it solves

```kotlin
// Without structured concurrency — classic async pain
val job1 = GlobalScope.launch { fetchMetadata(id) }
val job2 = GlobalScope.launch { fetchCover(id) }
// What if job1 fails? job2 is now an orphan.
// What if the caller is cancelled? job1 and job2 keep running.
// There is no "parent" concept.
```

### The structured concurrency answer

```kotlin
coroutineScope {           // creates a scope — a parent node
    val metadata = async { fetchMetadata(id) }
    val cover    = async { fetchCover(id) }
    Game(metadata.await(), cover.await())
}
// coroutineScope only returns when ALL children are done or cancelled
```

### The state machine angle

A `CoroutineScope` is itself a state machine over its children:

```
ACTIVE
  ├── child A: RUNNING
  └── child B: RUNNING

child A throws exception
  ↓
CANCELLING
  ├── child A: CANCELLED
  └── child B: CANCELLING → CANCELLED

  ↓
CANCELLED  (scope propagates exception to parent)
```

States of a coroutine (`Job`):
```
New → Active → Completing → Completed
                    ↓
               Cancelling → Cancelled
```

This is Structured Concurrency's contract:
1. **A parent never completes before its children** (structural guarantee)
2. **If a child fails, the parent cancels all siblings** (exception propagation)
3. **Cancellation flows top-down; completion flows bottom-up**

### Why this matters in practice

```kotlin
// This is safe — lifetime of child is strictly bounded by parent scope
suspend fun loadGameDetail(id: String): GameDetail = coroutineScope {
    val info    = async { fetchInfo(id) }
    val reviews = async { fetchReviews(id) }    // might take longer
    val similar = async { fetchSimilar(id) }

    // If user navigates away, the caller's scope is cancelled.
    // All three async blocks are cancelled automatically.
    // No manual job.cancel() needed. No leaks.
    GameDetail(info.await(), reviews.await(), similar.await())
}
```

The scope is the unit of ownership. The state machine enforces that ownership structurally.

---

## Segment 5 — JVM: Where Does the Continuation Actually Live? (2 min)

Brief and precise — don't go deep, just ground the abstraction.

When a coroutine suspends:
- The **call stack** is not on the OS thread stack
- It is captured into a **heap-allocated chain of `Continuation` objects** (one per `suspend` call frame)
- The OS thread is released back to the thread pool
- When resumed: the chain is walked and each frame's locals are restored

Concretely, for a coroutine with 3 suspension points:

```
Heap:
[ LoadGameStateMachine ]
    label = 1
    metadata = <Metadata>   ← saved local
    parent: Continuation    ← the caller's continuation (chain)
```

Compare to threads:
| | OS Thread | Kotlin Coroutine |
|---|---|---|
| Stack location | OS-managed, ~1MB | Heap, grows as needed |
| Blocking I/O | Blocks the thread | Suspends, releases thread |
| 10k concurrent | ~10GB RAM | Negligible overhead |
| State visibility | Opaque to runtime | Explicit `label` field |

The last row is the argument for state machines: explicit state means debuggable, serialisable, resumable across restarts.

---

## Closing — One Table (1 min)

| Concept | What it is | Kotlin incarnation |
|---|---|---|
| Continuation | "Everything left to do," made into an object | `Continuation<T>` interface; captured on suspend |
| CPS transform | Making continuation explicit in code | What `kotlinc` does to every `suspend fun` |
| State machine | Named pause points + event-driven transitions | The `label`-based class the compiler emits |
| Structured Concurrency | State machine over a scope tree, enforcing parent/child lifetime | `coroutineScope {}`, `Job` state (`Active → Cancelling → Cancelled`) |

**One sentence**: Every `suspend` point is a state transition; the compiler writes the state machine for you; Structured Concurrency extends that machine upward to govern the lifetime of entire call trees.

---

## Slide Outline (12 slides for 15 min)

| # | Title | Content |
|---|---|---|
| 1 | The Bookmark | Life metaphor diagram |
| 2 | Continuation: Definition | `Continuation<T>` interface code block |
| 3 | suspend = capture + release | Side-by-side: thread blocked vs coroutine suspended |
| 4 | What the compiler actually emits | `LoadGameStateMachine` pseudocode with `label` |
| 5 | TCP State Diagram | Classic FSM diagram, label states |
| 6 | TCP → Coroutine FSM | Same diagram shape, different labels |
| 7 | The Orphan Problem | `GlobalScope.launch` danger code |
| 8 | Structured Concurrency | `coroutineScope {}` code + "scope = parent node" |
| 9 | Scope State Machine | `Active → Cancelling → Cancelled` diagram |
| 10 | JVM: Where does it live? | Heap object diagram with `label`, `parent`, saved locals |
| 11 | Thread vs Coroutine table | The 5-row comparison table |
| 12 | Summary table | The four-concept one-liner table |

---

## Timing Guidance

| Segment | Time | Watch out for |
|---|---|---|
| Bookmark | 1 min | Don't over-explain — one sentence, move on |
| Coroutine suspend mechanics | 4 min | The compiler-emitted state machine is the hardest bit; draw `label` transitions on whiteboard if possible |
| TCP | 2 min | Audience interaction: ask them to name a state transition |
| Structured Concurrency | 4 min | The `coroutineScope` cancellation cascade is the payoff — make sure this lands |
| JVM internals | 2 min | Keep it visual, avoid bytecode |
| Summary | 1 min | Read the table out loud, done |

---

## Notes on Kotlin-Specific Accuracy

- `suspend` functions compile to a method with an extra `Continuation` parameter (the CPS transform is real, not metaphorical)
- `COROUTINE_SUSPENDED` is an actual sentinel object returned when a coroutine suspends mid-execution
- `CoroutineScope` is not a coroutine — it is a context holder. The state machine lives in `Job`, not `CoroutineScope`
- `async {}` returns `Deferred<T>` which extends `Job` — the state machine applies to it identically
- Structured concurrency was formalised by Roman Elizarov (JetBrains) in 2018; the paper "Notes on Structured Concurrency" by Nathaniel J. Smith is worth citing if the audience is academic
