import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/useTouchGalStore';
import { useUIStore } from '../store/uiStore';
import { MessageSquare, Star, Package, Heart, Coins, Users, User } from 'lucide-react';
import { CloudCollectionOverlay } from './CloudCollectionOverlay';
import type { TouchGalResource } from '../types';

const LoadingCircle: React.FC<{ label?: string; compact?: boolean }> = ({ label = 'Loading...', compact = false }) => (
  <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-14' : 'h-full'} text-on-surface-variant`}>
    <div className="relative">
      <div className={`${compact ? 'h-12 w-12' : 'h-16 w-16'} rounded-full border-4 border-slate-200`} />
      <div
        className={`absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-primary border-r-primary ${
          compact ? 'h-12 w-12' : 'h-16 w-16'
        }`}
      />
    </div>
    <div className={`${compact ? 'mt-4 text-sm' : 'mt-5 text-base'} font-black tracking-wide text-slate-500`}>{label}</div>
  </div>
);

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
  } = useAuthStore();
  const { selectResource } = useUIStore();

  const [activeTab, setActiveTab] = useState<'comments' | 'ratings' | 'collections'>('comments');
  const [selectedCloudCollection, setSelectedCloudCollection] = useState<any | null>(null);

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
    const { setIsLoginOpen } = useAuthStore.getState();
    return (
      <div className="flex flex-col items-center justify-center h-full text-on-surface-variant">
        <Users size={64} className="mb-4 opacity-20" />
        <p className="text-xl font-bold mb-6">Please log in to view your profile</p>
        <button 
          onClick={() => setIsLoginOpen(true)}
          className="bg-primary hover:bg-primary/90 text-on-primary font-bold py-3 px-8 rounded-full shadow-lg transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
        >
          <User size={20} />
          <span>Login Now</span>
        </button>
      </div>
    );
  }

  if (isLoading && !userProfile) {
    return <LoadingCircle label="Loading profile..." />;
  }

  const counts = userProfile?._count || {};
  const handleOpenCloudResource = async (resource: TouchGalResource) => {
    await selectResource(resource.uniqueId, resource);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left: Profile Summary */}
        <div className="lg:col-span-1">
          <div className="bg-surface rounded-3xl p-8 shadow-sm border border-outline-variant flex flex-col items-center text-center sticky top-8">
            <div className="relative group">
              <img 
                src={userProfile?.avatar || 'https://via.placeholder.com/150'} 
                alt={userProfile?.name} 
                className="w-40 h-40 rounded-full object-cover border-4 border-white shadow-xl mb-6 transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute bottom-6 right-2 bg-primary text-on-primary p-2 rounded-full shadow-lg border-2 border-white">
                <Heart size={20} fill="currentColor" />
              </div>
            </div>
            
            <h1 className="text-3xl font-black text-on-surface mb-2">{userProfile?.name || user.name}</h1>
            <p className="text-on-surface-variant text-sm mb-6 max-w-xs">{userProfile?.bio || 'This user is too lazy to write a bio.'}</p>
            
            <div className="flex gap-4 w-full mb-8">
              <div className="flex-1 bg-surface-container-low rounded-2xl p-4 border border-outline-variant">
                <div className="text-2xl font-bold text-on-surface">{userProfile?.follower || 0}</div>
                <div className="text-xs text-on-surface-variant uppercase tracking-wider font-bold">Followers</div>
              </div>
              <div className="flex-1 bg-surface-container-low rounded-2xl p-4 border border-outline-variant">
                <div className="text-2xl font-bold text-on-surface">{userProfile?.following || 0}</div>
                <div className="text-xs text-on-surface-variant uppercase tracking-wider font-bold">Following</div>
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
            <div className="bg-surface rounded-3xl p-6 shadow-sm border border-outline-variant">
              <div className="p-3 bg-primary-container text-primary rounded-2xl w-fit mb-4">
                <MessageSquare size={24} />
              </div>
              <div className="text-3xl font-black text-on-surface">{counts.patch_comment || 0}</div>
              <div className="text-sm text-on-surface-variant font-bold">Comments</div>
            </div>
            <div className="bg-surface rounded-3xl p-6 shadow-sm border border-outline-variant">
              <div className="p-3 bg-amber-50 text-amber-500 rounded-2xl w-fit mb-4">
                <Star size={24} />
              </div>
              <div className="text-3xl font-black text-on-surface">{counts.patch_rating || 0}</div>
              <div className="text-sm text-on-surface-variant font-bold">Ratings</div>
            </div>
            <div className="bg-surface rounded-3xl p-6 shadow-sm border border-outline-variant">
              <div className="p-3 bg-emerald-50 text-emerald-500 rounded-2xl w-fit mb-4">
                <Package size={24} />
              </div>
              <div className="text-3xl font-black text-on-surface">{counts.patch_favorite || counts.favorite_folder || userCollections.length || 0}</div>
              <div className="text-sm text-on-surface-variant font-bold">Collections</div>
            </div>
          </div>

          {/* Activity Tabs */}
          <div className="bg-surface rounded-3xl shadow-sm border border-outline-variant overflow-hidden">
            <div className="flex border-b border-surface-container">
              {(['comments', 'ratings', 'collections'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-5 text-sm font-bold uppercase tracking-wider transition-all duration-300 relative ${
                    activeTab === tab ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {tab}
                  {activeTab === tab && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-primary rounded-full" />
                  )}
                </button>
              ))}
            </div>

            <div className="p-6">
              {isLoading && <LoadingCircle label="Loading activity..." compact />}
              
              {!isLoading && activeTab === 'comments' && (
                <div className="space-y-4">
                  {userComments.length === 0 ? (
                    <div className="py-20 text-center text-outline font-bold">No comments found</div>
                  ) : (
                    userComments.map(comment => (
                      <div key={comment.id} className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant group hover:border-primary/20 transition-all">
                        <div className="text-xs font-bold text-primary mb-2 uppercase tracking-tight">{comment.patchName}</div>
                        <div className="text-on-surface font-medium mb-3">{comment.content}</div>
                        <div className="text-[10px] text-on-surface-variant font-bold">{new Date(comment.createdAt).toLocaleString()}</div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {!isLoading && activeTab === 'ratings' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userRatings.length === 0 ? (
                    <div className="col-span-2 py-20 text-center text-outline font-bold">No ratings found</div>
                  ) : (
                    userRatings.map(rating => (
                      <div key={rating.id} className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant hover:border-amber-200 transition-all">
                         <div className="flex justify-between items-start mb-3">
                            <div className="text-xs font-bold text-amber-600 uppercase tracking-tight truncate flex-1 mr-2">{rating.patchName}</div>
                            <div className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-lg text-xs font-black">
                               <Star size={12} fill="currentColor" />
                               {rating.overall}
                            </div>
                         </div>
                         <div className="text-on-surface-variant text-sm italic mb-2 line-clamp-2">"{rating.shortSummary}"</div>
                         <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                 rating.playStatus === 'finished' ? 'bg-emerald-100 text-emerald-700' : 'bg-primary-container text-primary'
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
                    <div className="col-span-2 py-20 text-center text-outline font-bold">No collections found</div>
                  ) : (
                    userCollections.map(folder => (
                      <button
                        key={folder.id}
                        className="flex w-full items-center justify-between p-5 bg-surface-container-low rounded-2xl border border-outline-variant hover:border-emerald-200 transition-all group cursor-pointer text-left"
                        onClick={() => setSelectedCloudCollection(folder)}
                        type="button"
                      >
                        <div className="flex items-center gap-4">
                           <div className="p-3 bg-white rounded-xl shadow-sm group-hover:bg-emerald-50 transition-colors">
                              <Package size={24} className="text-emerald-500" />
                           </div>
                           <div>
                              <h4 className="font-bold text-on-surface group-hover:text-emerald-600 transition-colors uppercase tracking-tight">{folder.name}</h4>
                              <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">{folder.is_public ? 'Public' : 'Private'} Collection</p>
                           </div>
                        </div>
                        <div className="bg-white px-3 py-1 rounded-full text-xs font-black text-on-surface-variant shadow-sm">
                           {folder._count?.patch || 0}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {selectedCloudCollection && (
        <CloudCollectionOverlay
          folder={selectedCloudCollection}
          onClose={() => setSelectedCloudCollection(null)}
          onOpenResource={handleOpenCloudResource}
        />
      )}
    </div>
  );
};

export default ProfileView;
