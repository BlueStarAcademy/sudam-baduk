import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { GameMode, ServerAction, Announcement, OverrideAnnouncement, UserWithStatus, LiveGameSession } from '../../types/index.js';
import Avatar from '../Avatar.js';
import HelpModal from '../HelpModal.js';
import { useAppContext } from '../../hooks/useAppContext.js';

// Import newly created sub-components
import { PlayerList } from './PlayerList.js';
import RankingList from './RankingList.js';
import GameList from './GameList.js';
import ChatWindow from './ChatWindow.js';
import TierInfoModal from '../TierInfoModal.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, aiUserId } from '../../constants/index.js';
// FIX: Import QuickAccessSidebar component to resolve module resolution error.
import QuickAccessSidebar from '../QuickAccessSidebar.js';
import BackButton from '../BackButton.js';
import Button from '../Button.js';
import NineSlicePanel from '../ui/NineSlicePanel.js';

interface WaitingRoomComponentProps {
    mode: GameMode;
}

const PLAYFUL_AI_MODES: GameMode[] = [GameMode.Dice, GameMode.Omok, GameMode.Ttamok, GameMode.Thief, GameMode.Alkkagi, GameMode.Curling];

function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

const AiChallengePanel: React.FC<{ mode: GameMode }> = ({ mode }) => {
    const { handlers } = useAppContext();
    const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === mode);
    const isPlayfulAiSupported = PLAYFUL_AI_MODES.includes(mode);

    if (!isStrategic && !isPlayfulAiSupported) {
        return null;
    }

    const handleChallenge = () => {
        handlers.handleAction({
            type: 'CHALLENGE_USER',
            payload: {
                opponentId: aiUserId,
                mode,
            }
        });
    };

    return (
        <NineSlicePanel className="shadow-lg p-2 flex items-center justify-between flex-shrink-0 text-on-panel" padding="p-2">
            <div className="flex items-center gap-3">
                 <Avatar userId={aiUserId} userName="AI" size={32} className="border-2 border-purple-500" />
                 <h3 className="text-base font-bold text-purple-300">AI와 대결하기</h3>
            </div>
            <div className="flex-1 text-right">
                <Button onClick={handleChallenge} colorScheme="purple" className="!text-sm !py-1.5">도전하기</Button>
            </div>
        </NineSlicePanel>
    );
};

const AnnouncementBoard: React.FC<{ mode: GameMode; }> = ({ mode }) => {
    const { announcements, globalOverrideAnnouncement, announcementInterval } = useAppContext();
    const [currentIndex, setCurrentIndex] = useState(0);
    const announcementIds = useMemo(() => announcements.map(a => a.id).join(','), [announcements]);

    useEffect(() => {
        if (!announcements || announcements.length <= 1) {
            setCurrentIndex(0);
            return;
        }
        const timer = setInterval(() => {
            setCurrentIndex(prevIndex => (prevIndex + 1) % announcements.length);
        }, announcementInterval * 1000);
        return () => clearInterval(timer);
    }, [announcementIds, announcements.length, announcementInterval]);

    const relevantOverride = globalOverrideAnnouncement && (globalOverrideAnnouncement.modes === 'all' || globalOverrideAnnouncement.modes.includes(mode));

    if (relevantOverride) {
        return (
            <div className="bg-yellow-800/50 border border-yellow-600 rounded-lg shadow-lg p-2 flex items-center justify-center flex-shrink-0 h-10">
                <span className="font-bold text-yellow-300 animate-pulse text-center">{globalOverrideAnnouncement.message}</span>
            </div>
        );
    }
    
    if (!announcements || announcements.length === 0) {
        return (
            <NineSlicePanel className="shadow-lg p-2 flex items-center justify-center flex-shrink-0 h-10 text-on-panel" padding="p-2">
                <span className="font-bold text-tertiary text-center">[현재 등록된 공지사항이 없습니다.]</span>
            </NineSlicePanel>
        );
    }

    return (
        <NineSlicePanel className="shadow-lg px-4 relative overflow-hidden flex-shrink-0 h-10" padding="px-4">
            <div
                className="w-full absolute top-0 left-0 transition-transform duration-1000 ease-in-out"
                style={{ transform: `translateY(-${currentIndex * 2.5}rem)` }}
            >
                {announcements.map((announcement) => (
                    <div key={announcement.id} className="w-full h-10 flex items-center justify-center">
                        <span className="font-bold">
                            <span className="text-red-500 mr-2">[공지]</span>
                            <span className="text-highlight">{announcement.message}</span>
                        </span>
                    </div>
                ))}
            </div>
        </NineSlicePanel>
    );
};


const WaitingRoom: React.FC<WaitingRoomComponentProps> = ({ mode }) => {
  const { 
    currentUserWithStatus, onlineUsers, allUsers, liveGames, 
    waitingRoomChats, negotiations, handlers 
  } = useAppContext();

  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [isTierInfoModalOpen, setIsTierInfoModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const desktopContainerRef = useRef<HTMLDivElement>(null);

  const chatMessages = waitingRoomChats['global'] || [];
  const prevChatLength = usePrevious(chatMessages.length);

  useEffect(() => {
    if (!isMobileSidebarOpen && prevChatLength !== undefined && chatMessages.length > prevChatLength) {
        setHasNewMessage(true);
    }
  }, [chatMessages.length, prevChatLength, isMobileSidebarOpen]);
  
  const onBackToLobby = () => {
    handlers.handleAction({ type: 'LEAVE_WAITING_ROOM' });
    const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === mode);
    window.location.hash = `#/lobby/${isStrategic ? 'strategic' : 'playful'}`;
  }

  useEffect(() => {
    const checkIsMobile = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);
  
  if (!currentUserWithStatus) return null;

  const ongoingGames = (Object.values(liveGames) as LiveGameSession[]).filter(g => g.mode === mode && !g.isAiGame);
  
  const usersInThisRoom = useMemo(() => {
    const othersInRoom = onlineUsers.filter(u => u.id !== currentUserWithStatus.id && u.mode === mode);
    return [currentUserWithStatus, ...othersInRoom];
  }, [onlineUsers, mode, currentUserWithStatus]);

  const isStrategic = useMemo(() => SPECIAL_GAME_MODES.some(m => m.mode === mode), [mode]);
  const lobbyType = isStrategic ? '전략' : '놀이';
  const locationPrefix = `[${lobbyType}:${mode}]`;
    
  return (
    <div className="bg-primary text-primary flex flex-col h-full max-w-full">
      <header className="flex justify-between items-center mb-2 flex-shrink-0 px-4">
        <div className="flex-1">
          <BackButton onClick={onBackToLobby} />
        </div>
        <div className='flex-1 text-center flex items-center justify-center'>
          <h1 className="text-xl sm:text-2xl font-bold">{mode} 대기실</h1>
          <button 
            onClick={() => setIsHelpModalOpen(true)}
            className="ml-2 w-7 h-7 flex items-center justify-center bg-secondary hover:bg-tertiary rounded-full text-primary font-bold text-lg flex-shrink-0 transition-transform hover:scale-110"
            aria-label="게임 방법 보기"
            title="게임 방법 보기"
          >
            <img src="/images/button/help.png" alt="도움말" className="h-4" />
          </button>
        </div>
        <div className="flex-1 text-right">
             <p className="text-secondary text-xs">{usersInThisRoom.length}명 접속 중</p>
        </div>
      </header>
      <div className="flex-1 min-h-0 relative px-4 pb-2">
        {isMobile ? (
          <>
            <div className="flex flex-col h-full gap-2">
                <div className="flex-shrink-0"><AnnouncementBoard mode={mode} /></div>
                <div className="flex-shrink-0"><AiChallengePanel mode={mode} /></div>
                <div className="flex-1 flex flex-col gap-2 min-h-0">
                    <NineSlicePanel className="h-1/2 shadow-lg flex flex-col min-h-0">
                        <GameList games={ongoingGames} onAction={handlers.handleAction} currentUser={currentUserWithStatus} />
                    </NineSlicePanel>
                    <NineSlicePanel className="h-1/2 shadow-lg flex flex-col min-h-0">
                        <ChatWindow messages={chatMessages} mode={'global'} locationPrefix={locationPrefix} />
                    </NineSlicePanel>
                </div>
            </div>
            <div className="absolute top-1/2 -translate-y-1/2 right-0 z-20">
                <button 
                    onClick={() => { setIsMobileSidebarOpen(true); setHasNewMessage(false); }}
                    className="w-8 h-12 bg-secondary/80 backdrop-blur-sm rounded-l-lg flex items-center justify-center text-primary shadow-lg"
                    aria-label="유저 및 랭킹 목록 열기"
                >
                    <span className="relative font-bold text-lg">
                        {'<'}
                        {hasNewMessage && <div className="absolute -top-1 -right-1.5 w-2.5 h-2.5 bg-danger rounded-full border-2 border-secondary"></div>}
                    </span>
                </button>
            </div>
            <div className={`fixed top-0 right-0 h-full w-[280px] bg-primary shadow-2xl z-50 transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <button onClick={() => setIsMobileSidebarOpen(false)} className="self-end text-2xl p-2 text-tertiary hover:text-primary">&times;</button>
                <div className="flex-shrink-0 p-2 border-b border-color">
                    <QuickAccessSidebar mobile={true} />
                </div>
                <div className="flex-1 min-h-0"><PlayerList users={usersInThisRoom} mode={mode} onAction={handlers.handleAction} currentUser={currentUserWithStatus} negotiations={Object.values(negotiations)} onViewUser={handlers.openViewingUser} /></div>
                <div className="flex-1 min-h-0 border-t border-color"><RankingList mode={mode} onShowTierInfo={() => setIsTierInfoModalOpen(true)} currentUser={currentUserWithStatus} onViewUser={handlers.openViewingUser} onShowPastRankings={handlers.openPastRankings} /></div>
            </div>
            {isMobileSidebarOpen && <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setIsMobileSidebarOpen(false)}></div>}
          </>
        ) : (
          <div ref={desktopContainerRef} className="grid grid-cols-1 lg:grid-cols-5 h-full gap-2">
            {/* Main Content Column */}
            <div className="lg:col-span-3 flex flex-col gap-2 min-h-0">
                <div className="flex-shrink-0">
                    <AnnouncementBoard mode={mode} />
                </div>
                 <div className="flex-shrink-0">
                    <AiChallengePanel mode={mode} />
                </div>
                <div className="flex flex-col gap-2 flex-1 min-h-0">
                    <div className="h-[55%]">
                        <NineSlicePanel className="h-full min-h-0 shadow-lg flex flex-col">
                            <GameList games={ongoingGames} onAction={handlers.handleAction} currentUser={currentUserWithStatus} />
                        </NineSlicePanel>
                    </div>
                    <div className="h-[45%]">
                        <NineSlicePanel className="h-full min-h-0 flex flex-col shadow-lg">
                            <ChatWindow messages={chatMessages} mode={'global'} onAction={handlers.handleAction} locationPrefix={locationPrefix} onViewUser={handlers.openViewingUser} />
                        </NineSlicePanel>
                    </div>
                </div>
            </div>
            
            {/* Right Sidebar Column */}
            <div className="lg:col-span-2 flex flex-col gap-2">
              <div className="h-[55%]">
                <div className="flex flex-row gap-2 items-stretch h-full">
                  <NineSlicePanel className="flex-1 shadow-lg min-w-0">
                    <PlayerList users={usersInThisRoom} mode={mode} onAction={handlers.handleAction} currentUser={currentUserWithStatus} negotiations={Object.values(negotiations)} onViewUser={handlers.openViewingUser} />
                  </NineSlicePanel>
                  <div className="w-20 flex-shrink-0 z-10">
                    <QuickAccessSidebar />
                  </div>
                </div>
              </div>
              <div className="h-[45%]">
                <NineSlicePanel className="h-full shadow-lg min-h-0">
                  <RankingList currentUser={currentUserWithStatus} mode={mode} onViewUser={handlers.openViewingUser} onShowTierInfo={() => setIsTierInfoModalOpen(true)} onShowPastRankings={handlers.openPastRankings} />
                </NineSlicePanel>
              </div>
            </div>
          </div>
        )}
      </div>
      {isTierInfoModalOpen && <TierInfoModal onClose={() => setIsTierInfoModalOpen(false)} />}
      {isHelpModalOpen && <HelpModal mode={mode} onClose={() => setIsHelpModalOpen(false)} />}
    </div>
  );
};

export default WaitingRoom;
