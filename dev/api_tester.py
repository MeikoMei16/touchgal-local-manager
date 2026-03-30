import requests
import json
import argparse
import sys
import os

def list_models(base_url, api_key):
    print(f"--- Listing Models for {base_url} ---")
    headers = {"Authorization": f"Bearer {api_key}"}
    try:
        response = requests.get(f"{base_url}/models", headers=headers, timeout=10)
        if response.status_code == 200:
            models = response.json().get('data', [])
            for m in models:
                print(f"- {m['id']}")
        else:
            print(f"Error {response.status_code}: {response.text}")
    except Exception as e:
        print(f"Exception: {e}")

def chat(base_url, api_key, model, prompt, temperature=0.3, max_tokens=4096, reasoning_effort="medium", stream=False):
    print(f"--- Chat Test ({model}) ---")
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": stream
    }
    # Some providers support reasoning_effort
    if reasoning_effort:
        payload["reasoning_effort"] = reasoning_effort

    try:
        response = requests.post(f"{base_url}/chat/completions", headers=headers, json=payload, timeout=60)
        if response.status_code == 200:
            content = response.json()['choices'][0]['message']['content']
            print(f"Response:\n{content}")
            print(f"\nUsage: {response.json().get('usage', {})}")
        else:
            print(f"Error {response.status_code}: {response.text}")
    except Exception as e:
        print(f"Exception: {e}")

def check_identity(base_url, api_key, model):
    print(f"--- Identity & Authenticity Test ({model}) ---")
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    tests = [
        ("Identity", "Who developed you? What is your model name?"),
        ("Logic (Strawberries)", "How many 'r's are in 'Strawberry'?"),
        ("Reasoning (Sally)", "Sally has 3 brothers. Each brother has 2 sisters. How many sisters does Sally have? Explain.")
    ]
    for name, prompt in tests:
        print(f"\n[Testing {name}] Prompt: {prompt}")
        payload = {"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0}
        try:
            res = requests.post(f"{base_url}/chat/completions", headers=headers, json=payload, timeout=30)
            if res.status_code == 200:
                print(f"Response: {res.json()['choices'][0]['message']['content']}")
            else:
                print(f"Error {res.status_code}")
        except Exception as e:
            print(f"Exception: {e}")

def main():
    parser = argparse.ArgumentParser(description="Unified OpenAI-Compatible API Tester")
    parser.add_argument("--url", default="https://jiuuij.de5.net/v1", help="API Base URL")
    parser.add_argument("--key", default=os.getenv("TEMP_KEY", "sk-lE36PxdW88GF60H7DdvFGcHgv9Q27A2RPvl9l1rp9u0d4rrD"), help="API Key")
    parser.add_argument("--model", default="gpt-5.4", help="Model ID")
    parser.add_argument("--temperature", type=float, default=0.3, help="Temperature (default 0.3)")
    parser.add_argument("--max_tokens", type=int, default=4096, help="Max tokens (default 4096)")
    parser.add_argument("--reasoning", default="medium", help="Reasoning effort (default medium)")
    parser.add_argument("--mode", choices=['chat', 'list', 'identity'], default='chat', help="Test mode")
    parser.add_argument("--prompt", default="Hello, world!", help="Prompt for chat mode")

    args = parser.parse_args()

    if args.mode == 'list':
        list_models(args.url, args.key)
    elif args.mode == 'identity':
        check_identity(args.url, args.key, args.model)
    else:
        chat(args.url, args.key, args.model, args.prompt, 
             temperature=args.temperature, 
             max_tokens=args.max_tokens, 
             reasoning_effort=args.reasoning)

if __name__ == "__main__":
    main()
