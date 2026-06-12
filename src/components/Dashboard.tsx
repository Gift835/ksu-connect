import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { supabase } from '../lib/supabase';
import Header from './Header';
import Sidebar from './Sidebar';
import RightPanel from './RightPanel';
import Feed from './Feed';
import Explore from './Explore';
import ProfilePage from './ProfilePage';
import NotificationsPage from './NotificationsPage';
import MessagesPage from './MessagesPage';
import PaymentPage from './PaymentPage';
import AdminPanel from './AdminPanel';
import SettingsPage from './SettingsPage';
import FollowersList from './FollowersList';
import { useToast } from '../context/ToastContext';
import LiveStreamModal from './LiveStreamModal';


export default function Dashboard() {
  const { user, profile, refreshProfile } = useAuth();
  const { isActive, isFree } = useSubscription();
  const { showToast } = useToast();
  const [activePage, setActivePage] = useState('feed');
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeLiveStream, setActiveLiveStream] = useState<{
    streamId?: string;
    streamTitle?: string;
    hostId?: string;
    isHost: boolean;
  } | null>(null);

  const handleStartLiveStream = () => {
    setActiveLiveStream({ isHost: true });
  };

  const handleWatchLiveStream = (streamId: string, streamTitle: string, hostId: string) => {
    setActiveLiveStream({ streamId, streamTitle, hostId, isHost: false });
  };

  // Suspended account check
  useEffect(() => {
    if (profile?.is_suspended) {
      showToast('Your account is suspended. You can only browse content.', 'error');
    }
  }, [profile?.is_suspended, showToast]);

  useEffect(() => {
    if (!user) return;
    fetchCounts();

    const notifSub = supabase.channel('notifs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => setUnreadNotifs(c => c + 1))
      .subscribe();

    const msgSub = supabase.channel('msgs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
        () => setUnreadMessages(c => c + 1))
      .subscribe();

    return () => {
      supabase.removeChannel(notifSub);
      supabase.removeChannel(msgSub);
    };
  }, [user]);

  const fetchCounts = async () => {
    if (!user) return;
    const { count: nc } = await supabase.from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('is_read', false);
    setUnreadNotifs(nc || 0);

    const { count: mc } = await supabase.from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', user.id).eq('is_read', false);
    setUnreadMessages(mc || 0);
  };

  const handleSetPage = (page: string) => {
    // Free users trying to post -> go to premium
    if (page === 'feed' && isFree) {
      // Allow them to view but feed will handle the rest
    }
    setActivePage(page);
    if (page === 'notifications') setUnreadNotifs(0);
    if (page === 'messages' || page.startsWith('messages:')) setUnreadMessages(0);
    if (mobileMenuOpen) setMobileMenuOpen(false);
  };

  const renderPage = () => {
    // If user is suspended, force them to a suspended-only view (read-only)
    if (profile?.is_suspended && !profile?.is_admin) {
      // Still allow browsing but Feed/PostCard will block posting
    }

    if (activePage === 'feed') return <Feed setActivePage={handleSetPage} onStartLive={handleStartLiveStream} onWatchLive={handleWatchLiveStream} />;
    if (activePage === 'explore') return <Explore setActivePage={handleSetPage} />;
    if (activePage === 'notifications') return <NotificationsPage setActivePage={handleSetPage} />;
    if (activePage === 'messages' || activePage.startsWith('messages:')) {
      const parts = activePage.split(':');
      return <MessagesPage initialUserId={parts[1]} setActivePage={handleSetPage} />;
    }
    if (activePage === 'profile') return <ProfilePage setActivePage={handleSetPage} />;
    if (activePage.startsWith('profile:')) {
      const uid = activePage.split(':')[1];
      return <ProfilePage userId={uid} setActivePage={handleSetPage} />;
    }
    if (activePage === 'trending' || activePage === 'people') {
      return <Explore setActivePage={handleSetPage} />;
    }
    if (activePage === 'premium') return <PaymentPage />;
    if (activePage === 'admin') return <AdminPanel />;
    if (activePage === 'settings') return <SettingsPage />;
    if (activePage.startsWith('followers:') || activePage.startsWith('following:')) {
      const [pageType, uid] = activePage.split(':');
      return <FollowersList userId={uid} type={pageType as 'followers' | 'following'} setActivePage={handleSetPage} />;
    }
    return <Feed setActivePage={handleSetPage} onStartLive={handleStartLiveStream} onWatchLive={handleWatchLiveStream} />;

  };

  return (
    <div className="app-layout">
      <Header
        activePage={activePage}
        setActivePage={handleSetPage}
        unreadNotifs={unreadNotifs}
        unreadMessages={unreadMessages}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />
      <Sidebar
        activePage={activePage}
        setActivePage={handleSetPage}
        unreadNotifs={unreadNotifs}
        unreadMessages={unreadMessages}
      />
      <main className="app-main">
        {renderPage()}
      </main>
      <RightPanel setActivePage={handleSetPage} />

      {activeLiveStream && (
        <LiveStreamModal
          streamId={activeLiveStream.streamId}
          streamTitle={activeLiveStream.streamTitle}
          hostId={activeLiveStream.hostId}
          isHost={activeLiveStream.isHost}
          onClose={() => setActiveLiveStream(null)}
        />
      )}
    </div>
  );
}
