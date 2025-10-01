import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
// FIX: Separate type and value imports
import { GameMode, UserStatus, ShopTab, InventoryTab } from '../types/index';
import type { User, LiveGameSession, UserWithStatus, ServerAction, Negotiation, ChatMessage, AdminLog, Announcement, OverrideAnnouncement, InventoryItem, AppState, InventoryItemType, AppRoute, QuestReward, DailyQuestData, WeeklyQuestData, MonthlyQuestData, Theme, SoundSettings, FeatureSettings, AppSettings, TowerRank, TournamentState, Guild, GuildBossBattleResult } from '../types/index';
// FIX: Corrected import path for audioService.
import { audioService } from '../services/audioService';
import { stableStringify, parseHash } from '../utils/appUtils';
import { 
    DAILY_MILESTONE_THRESHOLDS,
    WEEKLY_MILESTONE_THRESHOLDS,
    MONTHLY_MILESTONE_THRESHOLDS,
    SLUG_BY_GAME_MODE,
    SINGLE_PLAYER_MISSIONS
} from '../constants/index';
import { defaultSettings } from './useAppSettings';

function usePrevious<T>(value: T): T | undefined {
    const ref = useRef<T | undefined>(undefined);
    useEffect(() => {
        ref.current = value;
    }, [value]);
    return ref.current;
}

export const useApp = () => {
    // --- State Management ---
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);

    useEffect(() => {
        try {
            if (!sessionStorage.getItem('sessionIsActive')) {
                localStorage.removeItem('sessionData');
                sessionStorage.setItem('sessionIsActive', 'true');
                return;
            }
            const stored = localStorage.getItem('sessionData');
            if (stored) {
                const { user, sessionId: sid } = JSON.parse(stored);
                setCurrentUser(user);
                setSessionId(sid);
            }
        } catch (e) {
            console.error('Failed to initialize session from storage', e);
            localStorage.removeItem('sessionData');
            sessionStorage.removeItem('sessionIsActive');
        }
    }, []);

    const [currentRoute, setCurrentRoute] = useState<AppRoute>(() => parseHash(window.location.hash));
    const currentRouteRef = useRef(currentRoute);
    const [error, setError] = useState<string | null>(null);
    const [successToast, setSuccessToast] = useState<string | null>(null);
    const isLoggingOut = useRef(false);
    const isExitingGame = useRef(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    
    // --- App Settings State ---
    const [settings, setSettings] = useState<AppSettings>(() => {
        try {
            const storedSettings = localStorage.getItem('appSettings');
            if (storedSettings) {
                const parsed = JSON.parse(storedSettings);
                // Deep merge with defaults to ensure all keys are present
                return {
                    graphics: { ...defaultSettings.graphics, ...(parsed.graphics || {}) },
                    sound: { ...defaultSettings.sound, ...(parsed.sound || {}) },
                    features: { ...defaultSettings.features, ...(parsed.features || {}) },
                };
            }
        } catch (e) { console.error('Failed to load settings from localStorage', e); }
        return defaultSettings;
    });

    useEffect(() => {
        const checkIsMobile = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', checkIsMobile);
        return () => window.removeEventListener('resize', checkIsMobile);
    }, []);
    
    const handleLogout = useCallback(async () => {
        if (isLoggingOut.current) return;
        isLoggingOut.current = true;
        
        // Inform server of logout (fire and forget is fine)
        handleAction({ type: 'LOGOUT' });

        // Reset client-side state
        setCurrentUser(null);
        setSessionId(null);
        
        isLoggingOut.current = false;
        // Redirect to login page
        window.location.hash = '';
    }, []);
    
    const handleAction = useCallback(async (action: ServerAction): Promise<{success: boolean, error?: string, [key: string]: any} | undefined> => {
        if (
            action.type.startsWith('LEAVE_') || 
            action.type.startsWith('RESIGN_') ||
            action.type === 'REQUEST_NO_CONTEST_LEAVE'
        ) {
            isExitingGame.current = true;
            // Failsafe timeout to prevent getting stuck
            setTimeout(() => { isExitingGame.current = false; }, 3000);
        }

        if (action.type === 'CLEAR_TOURNAMENT_SESSION') {
            setCurrentUser(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    lastNeighborhoodTournament: null,
                    lastNationalTournament: null,
                    lastWorldTournament: null,
                };
            });
        }
        if (action.type === 'TOGGLE_EQUIP_ITEM') {
            setCurrentUser(prevUser => {
                if (!prevUser) return null;
                const { itemId } = action.payload;
                const itemToToggle = prevUser.inventory.find(i => i.id === itemId);
    
                if (!itemToToggle || itemToToggle.type !== 'equipment' || !itemToToggle.slot) {
                    return prevUser;
                }
    
                const slotToUpdate = itemToToggle.slot;
                const isEquipping = !itemToToggle.isEquipped;
                
                const newEquipment = { ...prevUser.equipment };
                if (isEquipping) {
                    newEquipment[slotToUpdate] = itemToToggle.id;
                } else {
                    delete newEquipment[slotToUpdate];
                }
    
                const newInventory = prevUser.inventory.map(item => {
                    if (item.id === itemId) return { ...item, isEquipped: isEquipping };
                    if (isEquipping && item.slot === slotToUpdate && item.id !== itemId) return { ...item, isEquipped: false };
                    return item;
                });
                
                return { ...prevUser, inventory: newInventory, equipment: newEquipment };
            });
        }

        try {
            audioService.initialize();
            const res = await fetch('/api/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...action, userId: currentUser?.id, sessionId }),
            });

            if (!res.ok) {
                if (res.status === 401) {
                    showError('다른 기기에서 로그인하여 세션이 만료되었습니다. 다시 로그인해주세요.');
                    if (!isLoggingOut.current) {
                        handleLogout();
                    }
                    return { success: false, error: 'Session expired' };
                }

                const errorData = await res.json();
                showError(errorData.message || 'An unknown error occurred.');
                 if (action.type === 'TOGGLE_EQUIP_ITEM' || action.type === 'USE_ITEM') {
                    setCurrentUser(prevUser => prevUser ? { ...prevUser } : null);
                 }
                return { success: false, error: errorData.message || 'An unknown error occurred.' };
            } else {
                const result = await res.json();
                
                if (result.successMessage) {
                    setSuccessToast(result.successMessage);
                    setTimeout(() => setSuccessToast(null), 3000);
                }

                // --- Start of new admin action response handling ---
                if (result.updatedUserDetail) {
                    const updatedUser = result.updatedUserDetail;
                    setUsersMap(currentMap => ({
                        ...currentMap,
                        [updatedUser.id]: updatedUser
                    }));
                    if (currentUser?.id === updatedUser.id) {
                        setCurrentUser(updatedUser);
                    }
                }
                if (result.deletedUserId) {
                    const deletedId = result.deletedUserId;
                    setUsersMap(currentMap => {
                        const newMap = { ...currentMap };
                        delete newMap[deletedId];
                        return newMap;
                    });
                }
                
                 if (result.newNegotiation) {
                    setNegotiations(negs => ({ ...negs, [result.newNegotiation.id]: result.newNegotiation }));
                }
                if (result.userStatusUpdate && currentUser) {
                    setOnlineUsers(users => users.map(u => 
                        u.id === currentUser.id ? { ...u, ...result.userStatusUpdate } : u
                    ));
                }

                if (result.updatedUser) {
                    setCurrentUser(result.updatedUser);
                }
                if (result.guilds) {
                    setGuilds(result.guilds);
                }
                 if (result.obtainedItemsBulk) {
                    setLastUsedItemResult(result.obtainedItemsBulk);
                 }
                 if (result.rewardSummary) setRewardSummary(result.rewardSummary);
                if (result.claimAllSummary) {
                    setClaimAllSummary(result.claimAllSummary);
                    setIsClaimAllSummaryOpen(true);
                }
                if (result.disassemblyResult) { 
                    setDisassemblyResult(result.disassemblyResult);
                    if (result.disassemblyResult.jackpot) audioService.disassemblyJackpot();
                }
                if (result.craftResult) {
                    setCraftResult(result.craftResult);
                }
                if (result.synthesisResult) {
                    setSynthesisResult(result.synthesisResult);
                }
                if (result.enhancementOutcome) {
                    const { message, success, itemBefore, itemAfter } = result.enhancementOutcome;
                    setEnhancementResult({ message, success });
                    setEnhancementOutcome({ message, success, itemBefore, itemAfter });
                    if (success) {
                        audioService.enhancementSuccess();
                    } else {
                        audioService.enhancementFail();
                    }
                }
                if (result.enhancementAnimationTarget) setEnhancementAnimationTarget(result.enhancementAnimationTarget);
                if (result.guildBossBattleResult) {
                    const bossName = action.payload?.bossName || '보스'; // Get bossName from payload
                    setGuildBossBattleResult({ ...result.guildBossBattleResult, bossName });
                }
                if (result.donationResult) {
                    setGuildDonationAnimation(result.donationResult);
                    setTimeout(() => setGuildDonationAnimation(null), 2500);
                }
                 return result;
            }
        } catch (err: any) {
            showError(err.message);
            return { success: false, error: err.message };
        }
    }, [currentUser?.id, sessionId, handleLogout]);
    
    useEffect(() => {
        const handler = setTimeout(() => {
            try {
                localStorage.setItem('appSettings', JSON.stringify(settings));
            } catch (e) {
                console.error('Failed to save settings to localStorage', e);
            }
        }, 1000); // Debounce save

        return () => {
            clearTimeout(handler);
        };
    }, [settings]);


    useEffect(() => {
        document.documentElement.setAttribute('data-theme', settings.graphics.theme);
    }, [settings.graphics.theme]);

    useEffect(() => {
        audioService.updateSettings(settings.sound);
    }, [settings.sound]);

    const updateTheme = useCallback((theme: Theme) => {
        setSettings(s => ({ 
            ...s, 
            graphics: { 
                ...s.graphics, 
                theme,
                // Reset custom colors when theme changes
                panelColor: undefined, 
                textColor: undefined,
            } 
        }));
    }, []);

    const updatePanelColor = useCallback((color: string) => {
        setSettings(s => ({ ...s, graphics: { ...s.graphics, panelColor: color }}));
    }, []);

    const updateTextColor = useCallback((color: string) => {
        setSettings(s => ({ ...s, graphics: { ...s.graphics, textColor: color }}));
    }, []);
    
    const resetGraphicsToDefault = useCallback(() => {
        setSettings(s => ({ ...s, graphics: { ...s.graphics, panelColor: undefined, textColor: undefined } }));
    }, []);

    const updateSoundSetting = useCallback(<K extends keyof SoundSettings>(key: K, value: SoundSettings[K]) => {
        setSettings(s => ({ ...s, sound: { ...s.sound, [key]: value } }));
    }, []);

    const updateFeatureSetting = useCallback(<K extends keyof FeatureSettings>(key: K, value: FeatureSettings[K]) => {
        setSettings(s => ({ ...s, features: { ...s.features, [key]: value } }));
    }, []);

    // --- Server State ---
    const [usersMap, setUsersMap] = useState<Record<string, User>>({});
    const [onlineUsers, setOnlineUsers] = useState<UserWithStatus[]>([]);
    const [liveGames, setLiveGames] = useState<Record<string, LiveGameSession>>({});
    const [negotiations, setNegotiations] = useState<Record<string, Negotiation>>({});
    const [waitingRoomChats, setWaitingRoomChats] = useState<Record<string, ChatMessage[]>>({});
    const [gameChats, setGameChats] = useState<Record<string, ChatMessage[]>>({});
    const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
    const [gameModeAvailability, setGameModeAvailability] = useState<Record<GameMode, boolean>>({} as Record<GameMode, boolean>);
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [globalOverrideAnnouncement, setGlobalOverrideAnnouncement] = useState<OverrideAnnouncement | null>(null);
    const [announcementInterval, setAnnouncementInterval] = useState(3);
    const [towerRankings, setTowerRankings] = useState<TowerRank[]>([]);
    const [guilds, setGuilds] = useState<Record<string, Guild>>({});
    
    // --- UI Modals & Toasts ---
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isInventoryOpen, setIsInventoryOpen] = useState(false);
    const [inventoryInitialTab, setInventoryInitialTab] = useState<InventoryTab>('all');
    const [isMailboxOpen, setIsMailboxOpen] = useState(false);
    const [isQuestsOpen, setIsQuestsOpen] = useState(false);
    const [isShopOpen, setIsShopOpen] = useState(false);
    const [shopInitialTab, setShopInitialTab] = useState<ShopTab>('equipment');
    const [isActionPointQuizOpen, setIsActionPointQuizOpen] = useState(false);
    const [lastUsedItemResult, setLastUsedItemResult] = useState<InventoryItem[] | null>(null);
    const [disassemblyResult, setDisassemblyResult] = useState<{ gained: { name: string, amount: number }[], jackpot: boolean } | null>(null);
    const [craftResult, setCraftResult] = useState<{ gained: { name: string; amount: number }[]; used: { name: string; amount: number }[]; craftType: 'upgrade' | 'downgrade'; } | null>(null);
    const [synthesisResult, setSynthesisResult] = useState<{ item: InventoryItem; wasUpgraded: boolean; } | null>(null);
    const [rewardSummary, setRewardSummary] = useState<{ reward: QuestReward; items: InventoryItem[]; title: string } | null>(null);
    const [isClaimAllSummaryOpen, setIsClaimAllSummaryOpen] = useState(false);
    const [claimAllSummary, setClaimAllSummary] = useState<{ gold: number; diamonds: number; actionPoints: number } | null>(null);
    const [viewingUser, setViewingUser] = useState<UserWithStatus | null>(null);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [isEncyclopediaOpen, setIsEncyclopediaOpen] = useState(false);
    const [isStatAllocationModalOpen, setIsStatAllocationModalOpen] = useState(false);
    const [enhancementResult, setEnhancementResult] = useState<{ message: string; success: boolean } | null>(null);
    const [enhancementOutcome, setEnhancementOutcome] = useState<{ message: string; success: boolean; itemBefore: InventoryItem; itemAfter: InventoryItem; } | null>(null);
    const [enhancementAnimationTarget, setEnhancementAnimationTarget] = useState<{ itemId: string; stars: number } | null>(null);
    const [pastRankingsInfo, setPastRankingsInfo] = useState<{ user: UserWithStatus; mode: GameMode; } | null>(null);
    const [enhancingItem, setEnhancingItem] = useState<InventoryItem | null>(null);
    const [viewingItem, setViewingItem] = useState<{ item: InventoryItem; isOwnedByCurrentUser: boolean; } | null>(null);
    const [showExitToast, setShowExitToast] = useState(false);
    const exitToastTimer = useRef<number | null>(null);
    const [isProfileEditModalOpen, setIsProfileEditModalOpen] = useState(false);
    const [moderatingUser, setModeratingUser] = useState<UserWithStatus | null>(null);
    const [isTowerRewardInfoOpen, setIsTowerRewardInfoOpen] = useState(false);
    const [levelUpInfo, setLevelUpInfo] = useState<{ type: 'strategy' | 'playful', newLevel: number } | null>(null);
    const [isGuildEffectsModalOpen, setIsGuildEffectsModalOpen] = useState(false);
    const [guildBossBattleResult, setGuildBossBattleResult] = useState<(GuildBossBattleResult & { bossName: string }) | null>(null);
    const [guildDonationAnimation, setGuildDonationAnimation] = useState<{ coins: number; research: number } | null>(null);
    const [isEquipmentEffectsModalOpen, setIsEquipmentEffectsModalOpen] = useState(false);
    const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);

    // --- Derived State ---
    const allUsers = useMemo(() => Object.values(usersMap), [usersMap]);

    const currentUserWithStatus: UserWithStatus | null = useMemo(() => {
        if (!currentUser) return null;
        const statusInfo = onlineUsers.find(u => u.id === currentUser.id);
        return { ...currentUser, ...(statusInfo || { status: UserStatus.Online }) };
    }, [currentUser, onlineUsers]);

    const activeGame = useMemo(() => {
        if (!currentUserWithStatus) return null;
        const gameId = currentUserWithStatus.gameId || currentUserWithStatus.spectatingGameId;
        if (gameId && (currentUserWithStatus.status === 'in-game' || currentUserWithStatus.status === 'spectating' || currentUserWithStatus.status === 'negotiating')) {
             const game = liveGames[gameId];
             if (game) return game;
        }
        return null;
    }, [currentUserWithStatus, liveGames]);

    const activeNegotiation = useMemo(() => {
        if (!currentUserWithStatus) return null;
        return Object.values(negotiations).find(neg => (
            (neg.challenger.id === currentUserWithStatus.id) ||
            (neg.opponent.id === currentUserWithStatus.id && neg.status === 'pending')
        )) || null;
    }, [currentUserWithStatus, negotiations]);

    const unreadMailCount = useMemo(() => currentUser?.mail.filter(m => !m.isRead).length || 0, [currentUser?.mail]);

    const hasClaimableQuest = useMemo(() => {
        if (!currentUser?.quests) return false;
        const { daily, weekly, monthly } = currentUser.quests;
    
        const checkQuestList = (questData?: DailyQuestData | WeeklyQuestData | MonthlyQuestData) => {
            if (!questData) return false;
            return questData.quests.some(q => q.progress >= q.target && !q.isClaimed);
        };
    
        const checkMilestones = (questData?: DailyQuestData | WeeklyQuestData | MonthlyQuestData, thresholds?: number[]) => {
            if (!questData || !thresholds) return false;
            return questData.claimedMilestones.some((claimed, index) => {
                return !claimed && questData.activityProgress >= thresholds[index];
            });
        };
    
        return checkQuestList(daily) ||
               checkQuestList(weekly) ||
               checkQuestList(monthly) ||
               checkMilestones(daily, DAILY_MILESTONE_THRESHOLDS) ||
               checkMilestones(weekly, WEEKLY_MILESTONE_THRESHOLDS) ||
               checkMilestones(monthly, MONTHLY_MILESTONE_THRESHOLDS);
    }, [currentUser?.quests]);

    const hasUnclaimedTournamentReward = useMemo(() => {
        if (!currentUserWithStatus) return false;
        const { 
            lastNeighborhoodTournament, neighborhoodRewardClaimed,
            lastNationalTournament, nationalRewardClaimed,
            lastWorldTournament, worldRewardClaimed 
        } = currentUserWithStatus;

        const checkReward = (state: TournamentState | null | undefined, claimed: boolean | undefined) => {
            if (!state) return false;
            return (state.status === 'complete' || state.status === 'eliminated') && !claimed;
        };

        return checkReward(lastNeighborhoodTournament, neighborhoodRewardClaimed) ||
               checkReward(lastNationalTournament, nationalRewardClaimed) ||
               checkReward(lastWorldTournament, worldRewardClaimed);
    }, [currentUserWithStatus]);

    const hasFullMissionReward = useMemo(() => {
        if (!currentUserWithStatus?.singlePlayerMissions) return false;
        
        for (const missionId in currentUserWithStatus.singlePlayerMissions) {
            const missionState = currentUserWithStatus.singlePlayerMissions[missionId];
            const missionInfo = SINGLE_PLAYER_MISSIONS.find(m => m.id === missionId);
            
            if (missionState && missionInfo && missionState.isStarted) {
                if (missionState.accumulatedAmount >= missionInfo.maxCapacity) {
                    return true;
                }
            }
        }
        return false;
    }, [currentUserWithStatus?.singlePlayerMissions]);
    
    const showError = (message: string) => {
        let displayMessage = message;
        if (message.includes('Invalid move: ko')) {
            displayMessage = "패 모양입니다. 다른 곳에 착수 후 다시 둘 수 있는 자리입니다.";
        } else if (message.includes('action point')) {
            displayMessage = "상대방의 행동력이 충분하지 않습니다.";
        }
        setError(displayMessage);
        setTimeout(() => setError(null), 5000);
    };
    
    const login = useCallback((user: User, sid: string) => {
        setCurrentUser(user);
        setSessionId(sid);
    }, []);

    useEffect(() => {
        if (currentUser && sessionId) {
            localStorage.setItem('sessionData', JSON.stringify({ user: currentUser, sessionId }));
            if (!sessionStorage.getItem('sessionIsActive')) {
                sessionStorage.setItem('sessionIsActive', 'true');
            }
        } else {
            localStorage.removeItem('sessionData');
            sessionStorage.removeItem('sessionIsActive');
        }
    }, [currentUser, sessionId]);

    const openShop = useCallback((tab: ShopTab = 'equipment') => {
        setShopInitialTab(tab);
        setIsShopOpen(true);
    }, []);

    const openInventory = useCallback((tab: InventoryTab = 'all') => {
        setInventoryInitialTab(tab);
        setIsInventoryOpen(true);
    }, []);
    
    // --- State Polling ---
    useEffect(() => {
        if (!currentUser?.id || !sessionId) return;
        let isCancelled = false;
    
        const poll = async () => {
            if (isLoggingOut.current || isCancelled) return;
    
            try {
                const response = await fetch('/api/state', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUser.id, sessionId }),
                });
    
                if (isLoggingOut.current || isCancelled) return;
    
                if (!response.ok) {
                    if (response.status === 401) {
                        showError('다른 기기에서 로그인하여 세션이 만료되었습니다. 다시 로그인해주세요.');
                        if (!isLoggingOut.current) { // Prevent multiple logout calls
                            handleLogout();
                        }
                        return; // Stop this poll cycle
                    }
                    throw new Error('Failed to fetch state');
                }
    
                const data: AppState & { guilds?: Record<string, Guild> } = await response.json();
                if (isLoggingOut.current || isCancelled) return;
                
                const updateStateIfChanged = <T,>(setter: React.Dispatch<React.SetStateAction<T>>, newData: T) => {
                    setter(currentData => stableStringify(currentData) !== stableStringify(newData) ? newData : currentData);
                };
    
                if (currentUser?.id) {
                    updateStateIfChanged<User | null>(setCurrentUser, data.users[currentUser.id] || null);
                }
                updateStateIfChanged(setUsersMap, data.users);
                updateStateIfChanged(setLiveGames, data.liveGames);
                updateStateIfChanged(setNegotiations, data.negotiations);
                updateStateIfChanged(setWaitingRoomChats, data.waitingRoomChats);
                updateStateIfChanged(setGameChats, data.gameChats);
                updateStateIfChanged(setAdminLogs, data.adminLogs);
                updateStateIfChanged(setGameModeAvailability, data.gameModeAvailability);
                updateStateIfChanged(setAnnouncements, data.announcements);
                updateStateIfChanged(setGlobalOverrideAnnouncement, data.globalOverrideAnnouncement);
                updateStateIfChanged(setAnnouncementInterval, data.announcementInterval);
                updateStateIfChanged(setTowerRankings, data.towerRankings || []);
                updateStateIfChanged(setGuilds, data.guilds || {});
    
                const onlineStatuses = Object.entries(data.userStatuses)
                    .map(([id, statusInfo]) => {
                        const user = data.users[id];
                        if (!user) return null;
                        return { ...user, ...statusInfo };
                    })
                    .filter((u): u is UserWithStatus => u !== null);
                updateStateIfChanged(setOnlineUsers, onlineStatuses);
            } catch (err) {
                console.error("Polling error:", err);
            }
        };
    
        poll();
        const interval = setInterval(poll, 1000);
    
        return () => {
            isCancelled = true;
            clearInterval(interval);
        };
    }, [currentUser?.id, sessionId, handleLogout]);

    // --- Navigation Logic ---
    const initialRedirectHandled = useRef(false);
    useEffect(() => { currentRouteRef.current = currentRoute; }, [currentRoute]);
    
    useEffect(() => {
        const handleHashChange = () => {
            const prevRoute = currentRouteRef.current;
            const newRoute = parseHash(window.location.hash);
            const isExiting = (prevRoute.view === 'profile' && newRoute.view === 'profile' && window.location.hash === '');
            
            if (isExiting && currentUser) {
                if (showExitToast) { handleLogout(); } 
                else {
                    setShowExitToast(true);
                    exitToastTimer.current = window.setTimeout(() => setShowExitToast(false), 2000);
                    window.history.pushState(null, '', '#/profile');
                    return;
                }
            } else {
                if (exitToastTimer.current) clearTimeout(exitToastTimer.current);
                if (showExitToast) setShowExitToast(false);
            }
            
            setCurrentRoute(newRoute);
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [currentUser, handleLogout, showExitToast]);

    useEffect(() => {
        if (!activeGame) {
            isExitingGame.current = false;
        }

        if (!currentUser) {
            initialRedirectHandled.current = false;
            if (window.location.hash && window.location.hash !== '#/register') window.location.hash = '';
            return;
        }
        
        if (!initialRedirectHandled.current) {
            initialRedirectHandled.current = true;
            if (window.location.hash === '' || window.location.hash === '#/') {
                if (activeGame) {
                    window.location.hash = `#/game/${activeGame.id}`;
                    return;
                }
                window.location.hash = '#/profile';
                return;
            }
        }
        
        const isGamePage = currentRoute.view === 'game';

        if (activeGame && (!isGamePage || currentRoute.params.id !== activeGame.id) && !isExitingGame.current) {
            console.warn("Router: Mismatch between route and active game state. Redirecting to game.");
            window.location.hash = `#/game/${activeGame.id}`;
        } else if (!activeGame && isGamePage) {
            const postGameRedirect = sessionStorage.getItem('postGameRedirect');
            let targetHash = postGameRedirect;
            
            if (targetHash) {
                sessionStorage.removeItem('postGameRedirect');
            } else if (currentUserWithStatus?.status === 'waiting' && currentUserWithStatus?.mode) {
                const slug = SLUG_BY_GAME_MODE.get(currentUserWithStatus.mode);
                if (slug) {
                    targetHash = `#/waiting/${slug}`;
                }
            }
            
            if (!targetHash) {
                 targetHash = '#/profile';
            }

            if (window.location.hash !== targetHash) {
                window.location.hash = targetHash;
            }
        }
    }, [currentUser, activeGame, currentRoute, currentUserWithStatus]);
    
    // --- Misc UseEffects ---
    useEffect(() => {
        const setVh = () => document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
        setVh();
        window.addEventListener('resize', setVh);
        window.addEventListener('orientationchange', setVh);
        return () => { window.removeEventListener('resize', setVh); window.removeEventListener('orientationchange', setVh); };
    }, []);

    useEffect(() => {
        if (enhancementResult) {
            const timer = setTimeout(() => {
                setEnhancementResult(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [enhancementResult]);

    useEffect(() => {
        if (enhancementOutcome) {
            setEnhancingItem(prevItem => {
                if (prevItem && prevItem.id === enhancementOutcome.itemAfter.id) {
                    return enhancementOutcome.itemAfter;
                }
                return prevItem;
            });
        }
    }, [enhancementOutcome]);
    const prevUser = usePrevious(currentUser);
    useEffect(() => {
        if (prevUser && currentUser && !levelUpInfo) {
            if (currentUser.strategyLevel > prevUser.strategyLevel) {
                setLevelUpInfo({ type: 'strategy', newLevel: currentUser.strategyLevel });
                audioService.levelUp();
            } else if (currentUser.playfulLevel > prevUser.playfulLevel) {
                setLevelUpInfo({ type: 'playful', newLevel: currentUser.playfulLevel });
                audioService.levelUp();
            }
        }
    }, [currentUser, prevUser, levelUpInfo]);

    const activeModalIds = useMemo(() => {
        const ids: string[] = [];
        if (activeNegotiation) ids.push('negotiation');
        if (isSettingsModalOpen) ids.push('settings');
        if (isInventoryOpen) ids.push('inventory');
        if (isMailboxOpen) ids.push('mailbox');
        if (isQuestsOpen) ids.push('quests');
        if (rewardSummary) ids.push('rewardSummary');
        if (isClaimAllSummaryOpen) ids.push('claimAllSummary');
        if (isShopOpen) ids.push('shop');
        if (isActionPointQuizOpen) ids.push('actionPointQuiz');
        if (lastUsedItemResult) ids.push('itemObtained');
        if (disassemblyResult) ids.push('disassemblyResult');
        if (craftResult) ids.push('craftResult');
        if (synthesisResult) ids.push('synthesisResult');
        if (viewingUser) ids.push('viewingUser');
        if (isInfoModalOpen) ids.push('infoModal');
        if (isEncyclopediaOpen) ids.push('encyclopedia');
        if (isStatAllocationModalOpen) ids.push('statAllocation');
        if (isProfileEditModalOpen) ids.push('profileEdit');
        if (pastRankingsInfo) ids.push('pastRankings');
        if (moderatingUser) ids.push('moderatingUser');
        if (viewingItem) ids.push('viewingItem');
        if (enhancingItem) ids.push('enhancingItem');
        if (isTowerRewardInfoOpen) ids.push('towerRewardInfo');
        if (isGuildEffectsModalOpen) ids.push('guildEffects');
        if (isEquipmentEffectsModalOpen) ids.push('equipmentEffects');
        if (isPresetModalOpen) ids.push('preset');
        if (levelUpInfo) ids.push('levelUp');
        if (guildBossBattleResult) ids.push('guildBossBattleResult');
        return ids;
    }, [
        activeNegotiation, isSettingsModalOpen, isInventoryOpen, isMailboxOpen, isQuestsOpen,
        rewardSummary, isClaimAllSummaryOpen, isShopOpen, isActionPointQuizOpen, lastUsedItemResult,
        disassemblyResult, craftResult, synthesisResult, viewingUser, isInfoModalOpen,
        isEncyclopediaOpen, isStatAllocationModalOpen, isProfileEditModalOpen, pastRankingsInfo,
        moderatingUser, viewingItem, enhancingItem, isTowerRewardInfoOpen, isGuildEffectsModalOpen,
        isEquipmentEffectsModalOpen, isPresetModalOpen, levelUpInfo, guildBossBattleResult
    ]);

    const handleEnterWaitingRoom = (mode: GameMode) => {
        handlers.handleAction({ type: 'ENTER_WAITING_ROOM', payload: { mode } });
        const slug = SLUG_BY_GAME_MODE.get(mode);
        if (slug) {
            window.location.hash = `#/waiting/${slug}`;
        }
    };
    
    const handleViewUser = useCallback((userId: string) => {
        const userToView = onlineUsers.find(u => u.id === userId) || allUsers.find(u => u.id === userId);
        if (userToView) {
            const statusInfo = onlineUsers.find(u => u.id === userId);
            const finalUser: UserWithStatus = {
                ...userToView,
                status: statusInfo?.status || UserStatus.Online,
                mode: statusInfo?.mode,
                gameId: statusInfo?.gameId,
                spectatingGameId: statusInfo?.spectatingGameId,
            };
            setViewingUser(finalUser);
        }
    }, [onlineUsers, allUsers]);

    const openModerationModal = useCallback((userId: string) => {
        const userToView = onlineUsers.find(u => u.id === userId) || allUsers.find(u => u.id === userId);
        if (userToView) {
            const statusInfo = onlineUsers.find(u => u.id === userId);
            const finalUser: UserWithStatus = {
                ...userToView,
                status: statusInfo?.status || UserStatus.Online,
                mode: statusInfo?.mode,
                gameId: statusInfo?.gameId,
                spectatingGameId: statusInfo?.spectatingGameId,
            };
            setModeratingUser(finalUser);
        }
    }, [onlineUsers, allUsers]);

    const closeModerationModal = useCallback(() => setModeratingUser(null), []);

    const openEnhancingItem = useCallback((item: InventoryItem) => {
        setEnhancingItem(item);
    }, []);

    const openEnhancementFromDetail = useCallback((item: InventoryItem) => {
        setEnhancingItem(item);
    }, []);

    const openViewingItem = useCallback((item: InventoryItem, isOwnedByCurrentUser: boolean) => {
        setViewingItem({ item, isOwnedByCurrentUser });
    }, []);

    const clearEnhancementOutcome = useCallback(() => {
        if (enhancementOutcome?.success) {
            const enhancedItem = enhancementOutcome.itemAfter;
            setViewingItem(currentItem => {
                if (currentItem && enhancedItem && currentItem.item.id === enhancedItem.id) {
                    return { ...currentItem, item: enhancedItem };
                }
                return currentItem;
            });
            setCurrentUser(prevUser => {
                if (!prevUser) return null;
                return {
                    ...prevUser,
                    inventory: prevUser.inventory.map(invItem => 
                        invItem.id === enhancedItem.id ? enhancedItem : invItem
                    ),
                };
            });
        }
        setEnhancementOutcome(null);
    }, [enhancementOutcome]);
    
    const closeEnhancementModal = useCallback(() => {
        setEnhancingItem(null);
        setEnhancementOutcome(null);
    }, []);

    const closeClaimAllSummary = useCallback(() => {
        setIsClaimAllSummaryOpen(false);
        setClaimAllSummary(null);
    }, []);

    const closeSynthesisResult = useCallback(() => setSynthesisResult(null), []);

    const openTowerRewardInfoModal = useCallback(() => setIsTowerRewardInfoOpen(true), []);
    const closeTowerRewardInfoModal = useCallback(() => setIsTowerRewardInfoOpen(false), []);
    const closeLevelUpModal = useCallback(() => setLevelUpInfo(null), []);
    const closeGuildBossBattleResultModal = useCallback(() => setGuildBossBattleResult(null), []);

    const setPostGameRedirect = useCallback((path: string) => {
        sessionStorage.setItem('postGameRedirect', path);
    }, []);
    
    const openGuildEffectsModal = useCallback(() => setIsGuildEffectsModalOpen(true), []);
    const closeGuildEffectsModal = useCallback(() => setIsGuildEffectsModalOpen(false), []);

    const handlers = {
        handleAction, handleLogout, handleEnterWaitingRoom,
        openInventory,
        openSettingsModal: () => setIsSettingsModalOpen(true),
        closeSettingsModal: () => setIsSettingsModalOpen(false),
        closeInventory: () => setIsInventoryOpen(false),
        openMailbox: () => setIsMailboxOpen(true),
        closeMailbox: () => setIsMailboxOpen(false),
        openQuests: () => setIsQuestsOpen(true),
        closeQuests: () => setIsQuestsOpen(false),
        openShop,
        closeShop: () => setIsShopOpen(false),
        openActionPointQuiz: () => setIsActionPointQuizOpen(true),
        closeActionPointQuiz: () => setIsActionPointQuizOpen(false),
        closeItemObtained: () => setLastUsedItemResult(null),
        closeDisassemblyResult: () => setDisassemblyResult(null),
        closeCraftResult: () => setCraftResult(null),
        closeSynthesisResult,
        closeRewardSummary: () => setRewardSummary(null),
        closeClaimAllSummary,
        openViewingUser: handleViewUser,
        closeViewingUser: () => setViewingUser(null),
        openInfoModal: () => setIsInfoModalOpen(true),
        closeInfoModal: () => setIsInfoModalOpen(false),
        openEncyclopedia: () => setIsEncyclopediaOpen(true),
        closeEncyclopedia: () => setIsEncyclopediaOpen(false),
        openStatAllocationModal: () => setIsStatAllocationModalOpen(true),
        closeStatAllocationModal: () => setIsStatAllocationModalOpen(false),
        openProfileEditModal: () => setIsProfileEditModalOpen(true),
        closeProfileEditModal: () => setIsProfileEditModalOpen(false),
        openPastRankings: (info: { user: UserWithStatus; mode: GameMode; }) => setPastRankingsInfo(info),
        closePastRankings: () => setPastRankingsInfo(null),
        openViewingItem,
        closeViewingItem: () => setViewingItem(null),
        openEnhancingItem,
        openEnhancementFromDetail,
        closeEnhancementModal,
        clearEnhancementOutcome,
        clearEnhancementAnimation: () => setEnhancementAnimationTarget(null),
        openModerationModal,
        closeModerationModal,
        openTowerRewardInfoModal,
        closeTowerRewardInfoModal,
        closeLevelUpModal,
        setPostGameRedirect,
        openGuildEffectsModal,
        closeGuildEffectsModal,
        closeGuildBossBattleResultModal,
        openEquipmentEffectsModal: () => setIsEquipmentEffectsModalOpen(true),
        closeEquipmentEffectsModal: () => setIsEquipmentEffectsModalOpen(false),
        openPresetModal: () => setIsPresetModalOpen(true),
        closePresetModal: () => setIsPresetModalOpen(false),
    };

    return {
        currentUser,
        login,
        currentUserWithStatus,
        currentRoute,
        error,
        successToast,
        allUsers,
        onlineUsers,
        liveGames,
        negotiations,
        waitingRoomChats,
        gameChats,
        adminLogs,
        gameModeAvailability,
        announcements,
        globalOverrideAnnouncement,
        announcementInterval,
        towerRankings,
        guilds,
        activeGame,
        activeNegotiation,
        showExitToast,
        enhancementResult,
        enhancementOutcome,
        unreadMailCount,
        hasClaimableQuest,
        hasUnclaimedTournamentReward,
        hasFullMissionReward,
        settings,
        updateTheme,
        updateSoundSetting,
        updateFeatureSetting,
        updatePanelColor,
        updateTextColor,
        resetGraphicsToDefault,
        modals: {
            isSettingsModalOpen, isInventoryOpen, inventoryInitialTab, isMailboxOpen, isQuestsOpen, isShopOpen, isActionPointQuizOpen, lastUsedItemResult,
            disassemblyResult, craftResult, synthesisResult, rewardSummary, viewingUser, isInfoModalOpen, isEncyclopediaOpen, isStatAllocationModalOpen, enhancementAnimationTarget,
            pastRankingsInfo, enhancingItem, viewingItem, isProfileEditModalOpen, moderatingUser,
            isClaimAllSummaryOpen,
            claimAllSummary,
            isTowerRewardInfoOpen,
            levelUpInfo,
            shopInitialTab,
            isGuildEffectsModalOpen,
            isEquipmentEffectsModalOpen,
            isPresetModalOpen,
            guildBossBattleResult,
            activeModalIds,
        },
        handlers,
        guildDonationAnimation,
        isMobile,
    };
};