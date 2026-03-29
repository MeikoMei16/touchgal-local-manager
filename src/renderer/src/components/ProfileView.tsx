import React, { useEffect, useState } from 'react';
import { useTouchGalStore } from '../store/useTouchGalStore';
import { MessageSquare, Star, Package, Heart, Coins, Users, User } from 'lucide-react';

const ProfileView: React.FC = () => {
  const { 
    user, 
    userProfile, 
    fetchUserProfile, 
    fetchUserActivity,
    userComments,
    userRatings,
    userCollections,
    isLoading 
  } = useTouchGalStore();

  const [activeTab, setActiveTab] = useState<'comments' | 'ratings' | 'collections'>('comments');

  useEffect(() => {
    if (user && !userProfile) {
      fetchUserProfile();
    }
  }, [user, userProfile, fetchUserProfile]);

  useEffect(() => {
    if (user) {
      fetchUserActivity(activeTab);
    }
  }, [user, activeTab, fetchUserActivity]);

  if (!user) {
    const { setIsLoginOpen } = useTouchGalStore();
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <Users size={64} className="mb-4 opacity-20" />
        <p className="text-xl font-bold mb-6">Please log in to view your profile</p>
        <button 
          onClick={() => setIsLoginOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
        >
          <User size={20} />
          <span>Login Now</span>
        </button>
      </div>
    );
  }

  if (isLoading && !userProfile) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const counts = userProfile?._count || {};

  return (
    <div className="p-8 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left: Profile Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col items-center text-center sticky top-8">
            <div className="relative group">
              <img 
                src={userProfile?.avatar || 'https://via.placeholder.com/150'} 
                alt={userProfile?.name} 
                className="w-40 h-40 rounded-full object-cover border-4 border-white shadow-xl mb-6 transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute bottom-6 right-2 bg-blue-500 text-white p-2 rounded-full shadow-lg border-2 border-white">
                <Heart size={20} fill="currentColor" />
              </div>
            </div>
            
            <h1 className="text-3xl font-black text-slate-800 mb-2">{userProfile?.name || user.name}</h1>
            <p className="text-slate-400 text-sm mb-6 max-w-xs">{userProfile?.bio || 'This user is too lazy to write a bio.'}</p>
            
            <div className="flex gap-4 w-full mb-8">
              <div className="flex-1 bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <div className="text-2xl font-bold text-slate-800">{userProfile?.follower || 0}</div>
                <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">Followers</div>
              </div>
              <div className="flex-1 bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <div className="text-2xl font-bold text-slate-800">{userProfile?.following || 0}</div>
                <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">Following</div>
              </div>
            </div>

            <div className="w-full space-y-3">
              <div className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-100 text-amber-700">
                <div className="flex items-center gap-3">
                  <Coins size={20} />
                  <span className="font-bold">MoeMoe Point</span>
                </div>
                <span className="text-lg font-black">{userProfile?.moemoepoint || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Stats & Activity */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <div className="p-3 bg-blue-50 text-blue-500 rounded-2xl w-fit mb-4">
                <MessageSquare size={24} />
              </div>
              <div className="text-3xl font-black text-slate-800">{counts.patch_comment || 0}</div>
              <div className="text-sm text-slate-400 font-bold">Comments</div>
            </div>
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <div className="p-3 bg-amber-50 text-amber-500 rounded-2xl w-fit mb-4">
                <Star size={24} />
              </div>
              <div className="text-3xl font-black text-slate-800">{counts.patch_rating || 0}</div>
              <div className="text-sm text-slate-400 font-bold">Ratings</div>
            </div>
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <div className="p-3 bg-emerald-50 text-emerald-500 rounded-2xl w-fit mb-4">
                <Package size={24} />
              </div>
              <div className="text-3xl font-black text-slate-800">{counts.favorite_folder || userCollections.length || 0}</div>
              <div className="text-sm text-slate-400 font-bold">Collections</div>
            </div>
          </div>

          {/* Activity Tabs */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="flex border-b border-slate-50">
              {(['comments', 'ratings', 'collections'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-5 text-sm font-bold uppercase tracking-wider transition-all duration-300 relative ${
                    activeTab === tab ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {tab}
                  {activeTab === tab && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-blue-600 rounded-full" />
                  )}
                </button>
              ))}
            </div>

            <div className="p-6">
              {isLoading && <div className="py-20 text-center text-slate-300 animate-pulse font-bold">Loading activity...</div>}
              
              {!isLoading && activeTab === 'comments' && (
                <div className="space-y-4">
                  {userComments.length === 0 ? (
                    <div className="py-20 text-center text-slate-300 font-bold">No comments found</div>
                  ) : (
                    userComments.map(comment => (
                      <div key={comment.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-blue-200 transition-all">
                        <div className="text-xs font-bold text-blue-500 mb-2 uppercase tracking-tight">{comment.patchName}</div>
                        <div className="text-slate-700 font-medium mb-3">{comment.content}</div>
                        <div className="text-[10px] text-slate-400 font-bold">{new Date(comment.createdAt).toLocaleString()}</div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {!isLoading && activeTab === 'ratings' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userRatings.length === 0 ? (
                    <div className="col-span-2 py-20 text-center text-slate-300 font-bold">No ratings found</div>
                  ) : (
                    userRatings.map(rating => (
                      <div key={rating.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-amber-200 transition-all">
                         <div className="flex justify-between items-start mb-3">
                            <div className="text-xs font-bold text-amber-600 uppercase tracking-tight truncate flex-1 mr-2">{rating.patchName}</div>
                            <div className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-lg text-xs font-black">
                               <Star size={12} fill="currentColor" />
                               {rating.overall}
                            </div>
                         </div>
                         <div className="text-slate-600 text-sm italic mb-2 line-clamp-2">"{rating.shortSummary}"</div>
                         <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                rating.playStatus === 'finished' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                               {rating.playStatus}
                            </span>
                         </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {!isLoading && activeTab === 'collections' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userCollections.length === 0 ? (
                    <div className="col-span-2 py-20 text-center text-slate-300 font-bold">No collections found</div>
                  ) : (
                    userCollections.map(folder => (
                      <div key={folder.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-emerald-200 transition-all group cursor-pointer">
                        <div className="flex items-center gap-4">
                           <div className="p-3 bg-white rounded-xl shadow-sm group-hover:bg-emerald-50 transition-colors">
                              <Package size={24} className="text-emerald-500" />
                           </div>
                           <div>
                              <h4 className="font-bold text-slate-800 group-hover:text-emerald-600 transition-colors uppercase tracking-tight">{folder.name}</h4>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{folder.is_public ? 'Public' : 'Private'} Collection</p>
                           </div>
                        </div>
                        <div className="bg-white px-3 py-1 rounded-full text-xs font-black text-slate-600 shadow-sm">
                           {folder._count?.patch || 0}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileView;
