import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    UserWithStatus, AppRoute, LiveGameSession, Negotiation, ChatMessage, GameMode, AdminLog, Announcement,
    OverrideAnnouncement, Guild, TowerRank, AppSettings, ServerAction, User, ItemGrade, InventoryItem, ShopTab, Theme, SoundCategory
} from '../types';
import { parseHash } from '../utils/appUtils';
import { defaultSettings } from './useAppSettings';
import { audioService } from '../services/audioService';
import { containsProfanity } from '../profanity';
import { SLUG_BY_GAME_MODE } from '../constants';

import { supabase } from '../services/supabase';

export const useApp = () => {
    // Core State
    const [currentUser, setCurrentUser] = useState<UserWithStatus | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // App Data State
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [onlineUsers, setOnlineUsers] = useState<UserWithStatus[]>([]);
    const [liveGames, setLiveGames] = useState<Record<string, LiveGameSession>>({});
    const [negotiations, setNegotiations] = useState<Record<string, Negotiation>>({});
    const [waitingRoomChats, setWaitingRoomChats] = useState<Record<string, ChatMessage[]>>({});
    const [gameChats, setGameChats] = useState<Record<string, ChatMessage[]>>({});
    const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [globalOverrideAnnouncement, setGlobalOverrideAnnouncement] = useState<OverrideAnnouncement | null>(null);
    const [gameModeAvailability, setGameModeAvailability] = useState<Record<GameMode, boolean>>({} as Record<GameMode, boolean>);
    const [announcementInterval, setAnnouncementInterval] = useState(3);
    const [guilds, setGuilds] = useState<Record<string, Guild>>({});
    const [towerRankings, setTowerRankings] = useState<TowerRank[]>([]);
    const [postGameRedirect, setPostGameRedirect] = useState<string | null>(null);
    const [currentRoute, setCurrentRoute] = useState<AppRoute>({ view: 'profile', params: {} });

    // UI State & Modal Management
    const [activeModalIds, setActiveModalIds] = useState<string[]>([]);
    const [viewingItem, setViewingItem] = useState<{ item: InventoryItem, isOwned: boolean } | null>(null);
    const [viewingUser, setViewingUser] = useState<UserWithStatus | null>(null);
    const [moderationUser, setModerationUser] = useState<UserWithStatus | null>(null);
    const [shopInitialTab, setShopInitialTab] = useState<ShopTab | null>(null);
    const [pastRankingsInfo, setPastRankingsInfo] = useState<{ user: UserWithStatus, mode: GameMode } | null>(null);
    const [enhancingItem, setEnhancingItem] = useState<InventoryItem | null>(null);
    const [enhancementOutcome, setEnhancementOutcome] = useState<any | null>(null);
    const [lastUsedItemResult, setLastUsedItemResult] = useState<InventoryItem[] | null>(null);
    const [rewardSummary, setRewardSummary] = useState<any | null>(null);
    const [claimAllSummary, setClaimAllSummary] = useState<any | null>(null);
    const [disassemblyResult, setDisassemblyResult] = useState<any | null>(null);
    const [craftResult, setCraftResult] = useState<any | null>(null);
    const [synthesisResult, setSynthesisResult] = useState<any | null>(null);
    const [levelUpInfo, setLevelUpInfo] = useState<{ type: 'strategy' | 'playful', newLevel: number } | null>(null);
    const [guildBossBattleResult, setGuildBossBattleResult] = useState<any | null>(null);
    const [guildDonationAnimation, setGuildDonationAnimation] = useState<{ coins: number; research: number } | null>(null);

    const [settings, setSettings] = useState<AppSettings>(defaultSettings);
    
    useEffect(() => {
        audioService.updateSettings(settings.sound);
    }, [settings.sound]);

    // Toast and Auth flow state
    const [successToast, setSuccessToast] = useState<string | null>(null);
    const [showExitToast, setShowExitToast] = useState(false);
    const [kakaoRegistrationData, setKakaoRegistrationData] = useState<any | null>(null);


    // Derived State
    const myGuild = useMemo(() => {
        if (!currentUser?.guildId) return null;
        return guilds[currentUser.guildId];
    }, [currentUser?.guildId, guilds]);
    
    const activeGameId = useMemo(() => {
        if (currentRoute.view === 'game') return currentRoute.params.id;
        const myStatus = onlineUsers.find(u => u.id === currentUser?.id);
        if (myStatus?.status === 'in-game' && myStatus.gameId) return myStatus.gameId;
        return null;
    }, [currentRoute, onlineUsers, currentUser]);
    
    const activeGame = useMemo(() => activeGameId ? liveGames[activeGameId] : null, [liveGames, activeGameId]);
    
    const activeNegotiation = useMemo(() => {
        if (!currentUser) return null;
        if (!negotiations) return null;
        return Object.values(negotiations).find(neg => 
            (neg.challenger.id === currentUser.id || neg.opponent.id === currentUser.id) &&
            (neg.status === 'pending' || neg.status === 'draft')
        ) || null;
    }, [negotiations, currentUser]);
    
    const hasClaimableQuest = useMemo(() => {
        if (!currentUser?.quests) return false;
        const { daily, weekly, monthly } = currentUser.quests;
        const checkQuests = (data: { quests: any[], activityProgress: number, claimedMilestones: boolean[] }, thresholds: number[]) => {
            if (data.quests.some(q => !q.isClaimed && q.progress >= q.target)) return true;
            if (thresholds.some((t, i) => !data.claimedMilestones[i] && data.activityProgress >= t)) return true;
            return false;
        };
        return checkQuests(daily, [20,40,60,80,100]) || checkQuests(weekly, [20,40,60,80,100]) || checkQuests(monthly, [20,40,60,80,100]);
    }, [currentUser?.quests]);

    const hasFullMissionReward = useMemo(() => {
        return false;
    }, [currentUser]);

    useEffect(() => {
        if (postGameRedirect && !activeGame) {
            window.location.hash = postGameRedirect;
            setPostGameRedirect(null);
        }
    }, [postGameRedirect, activeGame]);

    // Modal helpers
    const openModal = useCallback((id: string) => setActiveModalIds(prev => [...prev.filter(i => i !== id), id]), []);
    const closeModal = useCallback((id: string) => setActiveModalIds(prev => prev.filter(i => i !== id)), []);
    const isModalOpen = useCallback((id: string) => activeModalIds.includes(id), [activeModalIds]);
    const topmostModalId = useMemo(() => activeModalIds.length > 0 ? activeModalIds[activeModalIds.length - 1] : null, [activeModalIds]);

    // Handlers
    const handleLogout = useCallback(() => {
        if (sessionId && currentUser) {
            // Use sendBeacon for a last-ditch effort to notify the server on logout
            const payload = { type: 'LOGOUT', userId: currentUser.id, sessionId };
            navigator.sendBeacon('/api/action', JSON.stringify(payload));
        }
        
        localStorage.removeItem('user');
        localStorage.removeItem('sessionId');
        setCurrentUser(null);
        setSessionId(null);
        
        // FIX: Reset the hash to prevent the router from trying to render a protected route.
        window.location.hash = ''; 
        window.location.reload();
        
        // Optional: Force a reload to ensure a clean state, though state updates should handle it.
        // window.location.reload();

    }, [sessionId, currentUser]);

    const fetchInitialState = useCallback(async (userId: string, sessionId: string) => {
        try {
            setIsConnecting(true);
            const response = await fetch('/api/initial-state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, sessionId }),
            });
            if (!response.ok) {
                throw new Error('Failed to fetch initial state');
            }
            const data = await response.json();
            setAllUsers(Object.values(data.users));
            setLiveGames(data.liveGames);
            setGuilds(data.guilds);
            setTowerRankings(data.towerRankings);
            setAnnouncements(data.announcements);
            setGlobalOverrideAnnouncement(data.globalOverrideAnnouncement);
            setGameModeAvailability(data.gameModeAvailability);
            setAnnouncementInterval(data.announcementInterval);
            setNegotiations(data.negotiations || {});
            setWaitingRoomChats(data.waitingRoomChats || {});
            setGameChats(data.gameChats || {});
            setOnlineUsers(data.onlineUsers);

        } catch (err: any) {
            setError(err.message);
            // If we fail, logout
            handleLogout();
        } finally {
            setIsConnecting(false);
        }
    }, [handleLogout]);

    const login = useCallback((user: UserWithStatus, newSessionId: string) => {
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('sessionId', newSessionId);
        setCurrentUser(user);
        setSessionId(newSessionId);
        setIsLoading(false);
        audioService.initialize();
        fetchInitialState(user.id, newSessionId);
    }, [fetchInitialState]);

    const handleAction = useCallback(async (action: ServerAction) => {
        if (!sessionId || !currentUser) {
            console.error("Attempted to perform action without being logged in.");
            return;
        }
        try {
            const response = await fetch('/api/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...action, userId: currentUser.id, sessionId }),
            });

            const data = await response.json();
            console.log('Action response data:', data);

            if (!response.ok) {
                throw new Error(data.message || 'An unknown error occurred.');
            }
            
            if (data.updatedUser) {
                setCurrentUser(prev => ({...prev, ...data.updatedUser}));
            }
            if (data.guilds) {
                setGuilds(data.guilds);
            }
            if(data.donationResult) {
                setGuildDonationAnimation(data.donationResult);
                setTimeout(() => setGuildDonationAnimation(null), 2000);
            }

            if (data.newGameId) {
                window.location.hash = `#/game/${data.newGameId}`;
            }

            if (data.newNegotiation) {
                setNegotiations(prev => ({...prev, [data.newNegotiation.id]: data.newNegotiation}));
            }

            if (data.updatedNegotiations) {
                setNegotiations(data.updatedNegotiations);
            }

            if (data.obtainedItemsBulk) {
                setLastUsedItemResult(data.obtainedItemsBulk);
                openModal('itemObtained');
            }

            if (data.deletedGameId) {
                setLiveGames(prev => {
                    const newLiveGames = { ...prev };
                    delete newLiveGames[data.deletedGameId];
                    return newLiveGames;
                });
            }

            if (data.updatedGame) {
                setLiveGames(prev => ({...prev, [data.updatedGame.id]: data.updatedGame}));
            }

            return { success: true, ...data };
        } catch (err: any) {
            console.error(`Action ${action.type} failed:`, err);
            setError(err.message);
            if (err.message === 'Session expired due to new login.') {
                handleLogout();
            }
            return { success: false, error: err.message };
        }
    }, [sessionId, currentUser, openModal, handleLogout]);

    const updateSettingsState = useCallback((newSettings: AppSettings) => {
        setSettings(newSettings);
        localStorage.setItem('appSettings', JSON.stringify(newSettings));
    }, []);

    const updateTheme = useCallback((theme: Theme) => {
        setSettings(s => {
            const newSettings = { ...s, graphics: { ...s.graphics, theme } };
            updateSettingsState(newSettings);
            return newSettings;
        });
    }, [updateSettingsState]);
    
    const updateSoundSetting = useCallback((key: keyof AppSettings['sound'], value: any) => {
        setSettings(s => {
            const newSettings = { ...s, sound: { ...s.sound, [key]: value } };
            updateSettingsState(newSettings);
            return newSettings;
        });
    }, [updateSettingsState]);

    const updateFeatureSetting = useCallback((key: keyof AppSettings['features'], value: any) => {
        setSettings(s => {
            const newSettings = { ...s, features: { ...s.features, [key]: value } };
            updateSettingsState(newSettings);
            return newSettings;
        });
    }, [updateSettingsState]);
    
    const handlers = useMemo(() => ({
        handleAction,
        handleLogout,
        login,
        setPostGameRedirect,
        openShop: (tab: ShopTab) => { setShopInitialTab(tab); openModal('shop'); },
        closeShop: () => closeModal('shop'),
        openInventory: () => openModal('inventory'),
        closeInventory: () => closeModal('inventory'),
        openQuests: () => openModal('quests'),
        closeQuests: () => closeModal('quests'),
        openMailbox: () => openModal('mailbox'),
        closeMailbox: () => closeModal('mailbox'),
        openSettingsModal: () => openModal('settings'),
        closeSettingsModal: () => closeModal('settings'),
        openViewingItem: (item: InventoryItem, isOwned: boolean) => { setViewingItem({item, isOwned}); openModal('viewingItem'); },
        closeViewingItem: () => { closeModal('viewingItem'); setViewingItem(null); },
        openViewingUser: (userId: string) => {
            const userToView = allUsers.find(u => u.id === userId) || onlineUsers.find(u => u.id === userId);
            if(userToView) { setViewingUser(userToView as UserWithStatus); openModal('viewingUser'); }
        },
        closeViewingUser: () => { closeModal('viewingUser'); setViewingUser(null); },
        openModerationModal: (userId: string) => {
            const userToModerate = onlineUsers.find(u => u.id === userId);
            if (userToModerate) {
                setModerationUser(userToModerate);
                openModal('moderation');
            }
        },
        closeModerationModal: () => { closeModal('moderation'); setModerationUser(null); },
        openProfileEditModal: () => openModal('profileEdit'),
        closeProfileEditModal: () => closeModal('profileEdit'),
        openStatAllocationModal: () => openModal('statAllocation'),
        closeStatAllocationModal: () => closeModal('statAllocation'),
        openGuildEffectsModal: () => openModal('guildEffects'),
        closeGuildEffectsModal: () => closeModal('guildEffects'),
        openGuildShop: () => openModal('guildShop'),
        closeGuildShop: () => closeModal('guildShop'),
        openPresetModal: () => openModal('preset'),
        closePresetModal: () => closeModal('preset'),
        openPastRankings: (info: { user: UserWithStatus, mode: GameMode }) => { setPastRankingsInfo(info); openModal('pastRankings'); },
        closePastRankings: () => { closeModal('pastRankings'); setPastRankingsInfo(null); },
        openEncyclopedia: () => openModal('encyclopedia'),
        closeEncyclopedia: () => closeModal('encyclopedia'),
        openActionPointQuiz: () => openModal('actionPointQuiz'),
        closeActionPointQuiz: () => closeModal('actionPointQuiz'),
        openEquipmentEffectsModal: () => openModal('equipmentEffects'),
        closeEquipmentEffectsModal: () => closeModal('equipmentEffects'),
        openInfoModal: () => openModal('info'),
        closeInfoModal: () => closeModal('info'),
        openEnhancement: (item: InventoryItem) => { setEnhancingItem(item); openModal('blacksmith'); },
        closeEnhancementModal: () => { closeModal('blacksmith'); setEnhancingItem(null); setEnhancementOutcome(null); },
        clearEnhancementOutcome: () => setEnhancementOutcome(null),
        closeItemObtained: () => { closeModal('itemObtained'); setLastUsedItemResult(null); },
        closeRewardSummary: () => { closeModal('rewardSummary'); setRewardSummary(null); },
        closeClaimAllSummary: () => { closeModal('claimAllSummary'); setClaimAllSummary(null); },
        closeDisassemblyResult: () => { closeModal('disassemblyResult'); setDisassemblyResult(null); },
        closeCraftResult: () => { closeModal('craftResult'); setCraftResult(null); },
        closeSynthesisResult: () => { closeModal('synthesisResult'); setSynthesisResult(null); },
        closeTowerRewardInfoModal: () => closeModal('towerRewardInfo'),
        closeLevelUpModal: () => { closeModal('levelUp'); setLevelUpInfo(null); },
        closeGuildBossBattleResultModal: () => { closeModal('guildBossBattleResult'); setGuildBossBattleResult(null); },
        setIsBlacksmithHelpOpen: (isOpen: boolean) => isOpen ? openModal('blacksmithHelp') : closeModal('blacksmithHelp'),
        openBlacksmith: () => openModal('blacksmith'),
        closeBlacksmith: () => { closeModal('blacksmith'); setEnhancingItem(null); },
        handleEnterWaitingRoom: (mode: GameMode) => {
            handleAction({ type: 'ENTER_WAITING_ROOM', payload: { mode } });
            const slug = SLUG_BY_GAME_MODE.get(mode);
            if (slug) window.location.hash = `#/waiting/${slug}`;
        },
        updateTheme,
        updateSoundSetting,
        updateFeatureSetting,
        updatePanelColor: (color: string) => {},
        updateTextColor: (color: string) => {},
        resetGraphicsToDefault: () => {},
        closeAllModals: () => setActiveModalIds([]),
    }), [handleAction, handleLogout, login, allUsers, onlineUsers, openModal, closeModal, updateTheme, updateSoundSetting, updateFeatureSetting, fetchInitialState]);

    useEffect(() => {
        const restoreSession = async () => {
            try {
                const savedUserJSON = localStorage.getItem('user');
                const savedSessionId = localStorage.getItem('sessionId');

                if (savedUserJSON && savedSessionId) {
                    const savedUser = JSON.parse(savedUserJSON);
                    setCurrentUser(savedUser);
                    setSessionId(savedSessionId);
                    await fetchInitialState(savedUser.id, savedSessionId);
                    audioService.initialize(); // Initialize audio on session restore too
                } else {
                    setIsLoading(false);
                }
            } catch (error) {
                console.error("Failed to load user data from localStorage", error);
                // If there's an error, clear the potentially corrupted data.
                localStorage.removeItem('user');
                localStorage.removeItem('sessionId');
                setIsLoading(false);
            }
        };
        restoreSession();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

        useEffect(() => {

            const handleHashChange = () => {

                const newRoute = parseHash(window.location.hash);

                setCurrentRoute(newRoute);

            };

            window.addEventListener('hashchange', handleHashChange);

            handleHashChange();

            return () => window.removeEventListener('hashchange', handleHashChange);

        }, []);

    

        useEffect(() => {

            if (sessionId) {

                const intervalId = setInterval(() => {

                    handleAction({ type: 'HEARTBEAT' });

                }, 60000); // 1 minute

    

                return () => clearInterval(intervalId);

            }

        }, [sessionId, handleAction]);

        
    
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'sessionId' && e.newValue !== sessionId) {
                // Session changed in another tab, force logout to be safe
                handleLogout();
            }
        };

        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [sessionId, handleLogout]);

    useEffect(() => {
        if (!sessionId) return;

        const setupChatSubscription = () => {
            const channel = supabase.channel('chat_room');

            channel.on('broadcast', { event: 'chat_message' }, (payload) => {
                const { channel: chatChannel, message } = payload.payload;
                if (chatChannel === 'global') {
                    setWaitingRoomChats(prev => ({
                        ...prev,
                        global: [...(prev.global || []), message].slice(-100)
                    }));
                } else {
                    setGameChats(prev => ({
                        ...prev,
                        [chatChannel]: [...(prev[chatChannel] || []), message].slice(-100)
                    }));
                }
            })
            .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        };

        const unsubscribe = setupChatSubscription();
        return () => unsubscribe();
    }, [sessionId]); // Re-subscribe if sessionId changes

    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 1024);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return {
        currentUser,
        currentUserWithStatus: currentUser,
        sessionId,
        isLoading,
        isConnecting,
        error,
        allUsers,
        onlineUsers,
        liveGames,
        negotiations,
        waitingRoomChats,
        gameChats,
        adminLogs,
        announcements,
        globalOverrideAnnouncement,
        gameModeAvailability,
        announcementInterval,
        guilds,
        towerRankings,
        currentRoute,
        activeGame,
        activeNegotiation,
        settings,
        hasClaimableQuest,
        hasFullMissionReward,
        isMobile,
        handlers,
        // New state for App.tsx
        kakaoRegistrationData,
        successToast,
        showExitToast,
        myGuild,
        // Modal state and data
        modals: { // This structure is now for passing data, not for opening/closing
            isSettingsModalOpen: isModalOpen('settings'),
            isInventoryOpen: isModalOpen('inventory'),
            isMailboxOpen: isModalOpen('mailbox'),
            isQuestsOpen: isModalOpen('quests'),
            isShopOpen: isModalOpen('shop'),
            shopInitialTab,
            viewingItem,
            viewingUser,
            pastRankings: pastRankingsInfo,
            encyclopedia: isModalOpen('encyclopedia'),
            guildDonationAnimation,
            moderation: moderationUser,
            actionPointQuiz: isModalOpen('actionPointQuiz'),
            equipmentEffects: isModalOpen('equipmentEffects'),
            info: isModalOpen('info'),
            profileEdit: isModalOpen('profileEdit'),
            statAllocation: isModalOpen('statAllocation'),
            guildEffects: isModalOpen('guildEffects'),
            preset: isModalOpen('preset'),
            lastUsedItemResult,
            rewardSummary,
            isClaimAllSummaryOpen: isModalOpen('claimAllSummary'),
            claimAllSummary,
            disassemblyResult,
            craftResult,
            synthesisResult,
            enhancingItem,
            isBlacksmithOpen: isModalOpen('blacksmith'),
            isBlacksmithHelpOpen: isModalOpen('blacksmithHelp'),
            enhancementOutcome,
            isTowerRewardInfoOpen: isModalOpen('towerRewardInfo'),
            levelUpInfo,
            guildBossBattleResult,
            activeModalIds, // For isTopmost logic
        },
        topmostModalId,
        activeModalIds
    };
};
