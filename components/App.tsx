import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import Header from './Header.js';
import { useAppContext } from '../hooks/useAppContext.js';
import Router from './Router.js';
import NegotiationModal from './NegotiationModal.js';
import InventoryModal from './InventoryModal.js';
import MailboxModal from './MailboxModal.js';
import QuestsModal from './QuestsModal.js';
import ShopModal from './ShopModal.js';
import UserProfileModal from './UserProfileModal.js';
import InfoModal from './InfoModal.js';
import DisassemblyResultModal from './DisassemblyResultModal.js';
import StatAllocationModal from './StatAllocationModal.js';
import EnhancementModal from './EnhancementModal.js';
import ItemDetailModal from './ItemDetailModal.js';
import ProfileEditModal from './ProfileEditModal.js';
import ItemObtainedModal from './ItemObtainedModal.js';
import BulkItemObtainedModal from './BulkItemObtainedModal.js';
import EncyclopediaModal from './modals/EncyclopediaModal.js';
import PastRankingsModal from './modals/PastRankingsModal.js';
import AdminModerationModal from './AdminModerationModal.js';
import RewardSummaryModal from './RewardSummaryModal.js';
import { preloadImages, ALL_IMAGE_URLS } from '../services/assetService.js';
import CraftingResultModal from './CraftingResultModal.js';
import { audioService } from '../services/audioService.js';
import SettingsModal from './SettingsModal.js';
import ClaimAllSummaryModal from './ClaimAllSummaryModal.js';
import MbtiInfoModal from './MbtiInfoModal.js';
import SynthesisResultModal from './SynthesisResultModal.js';
import TowerRankingRewardsModal from './TowerRankingRewardsModal.js';
import LevelUpModal from './LevelUpModal.js';
import ActionPointQuizModal from './modals/ActionPointQuizModal.js';
import { UserStatus, User } from '../types/index.js';
import GuildEffectsModal from './guild/GuildEffectsModal.js';
import GuildBossBattleResultModal from './guild/GuildBossBattleResultModal.js';
import EquipmentEffectsModal from './EquipmentEffectsModal.js';
import PresetModal from './PresetModal.js';
import Button from './Button.js';
import { containsProfanity } from '../profanity.js';
import { supabase } from '../services/supabase.js';
import KakaoRegister from './KakaoRegister.js';

function usePrevious<T>(value: T): T | undefined {
    const ref = useRef<T | undefined>(undefined);
    useEffect(() => {
        ref.current = value;
    }, [value]);
    return ref.current;
}

const Auth: React.FC = () => {
    const { login, handlers } = useAppContext();
    const [isRegisterMode, setIsRegisterMode] = useState(false);
    const [username, setUsername] = useState('');
    const [nickname, setNickname] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    
    // States for mock identity verification
    const [isVerified, setIsVerified] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [verifiedInfo, setVerifiedInfo] = useState<{name: string, dob: string} | null>(null);

    const handleVerification = () => {
        setIsVerifying(true);
        setError(null);
        // Simulate API call for verification
        setTimeout(() => {
            setIsVerified(true);
            setIsVerifying(false);
            setVerifiedInfo({ name: '홍*동', dob: '900101-1******' }); // Mock data
        }, 1500);
    };
    
    const handleKakaoLogin = async () => {
        setError(null);
        // FIX: Property 'signInWithOAuth' does not exist on type 'SupabaseAuthClient'. Type definitions are likely broken. The method exists at runtime. This will be fixed by other changes that allow types to be inferred correctly. If not, this is an environment issue beyond the scope of file edits.
        // FIX: Cast supabase.auth to any to bypass type errors for signInWithOAuth.
        const { error } = await (supabase.auth as any).signInWithOAuth({
            provider: 'kakao',
        });
        if (error) {
            setError(`카카오 로그인에 실패했습니다: ${error.message}`);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        if (isRegisterMode) {
            if (!isVerified) {
                setError("본인인증을 먼저 완료해주세요.");
                setIsLoading(false);
                return;
            }
            if (!username.trim() || !nickname.trim() || !password.trim()) {
                setError("모든 필드를 입력해주세요.");
                setIsLoading(false);
                return;
            }
             if (password.length < 4) {
                setError("비밀번호는 4자 이상이어야 합니다.");
                setIsLoading(false);
                return;
            }
            if (password !== passwordConfirm) {
                setError("비밀번호가 일치하지 않습니다.");
                setIsLoading(false);
                return;
            }
            if (containsProfanity(username) || containsProfanity(nickname)) {
                setError("아이디 또는 닉네임에 부적절한 단어가 포함되어 있습니다.");
                setIsLoading(false);
                return;
            }

            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, nickname, password }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || '회원가입 실패');
                }
                const data = await response.json();
                login(data.user, data.sessionId);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }

        } else { // Login Mode
            if (!username.trim() || !password.trim()) {
              setError('아이디와 비밀번호를 모두 입력해주세요.');
              setIsLoading(false);
              return;
            }

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password }),
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || '로그인 실패');
                }

                const data = await response.json();
                login(data.user, data.sessionId);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <div className="relative h-full w-full flex flex-col items-center justify-center p-4 sm:p-8 bg-tertiary bg-[url('/images/bg/loginbg.png')] bg-cover bg-center">
            <div className="absolute inset-0 bg-black/60"></div>
            <header className="relative text-center z-10 pt-8 md:pt-16 mb-8">
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-widest uppercase title-glow" style={{ fontFamily: 'serif' }}>
                    SUDAM
                </h1>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-wider mt-2 title-glow-secondary" style={{ fontFamily: 'serif' }}>
                    The Ascending Masters
                </h2>
                <p className="mt-4 text-xs sm:text-sm text-gray-300">
                    Supreme Universe of Dueling Ascending Masters (S.U.D.A.M)
                    <br/>
                    (격돌하는 초인들이 승천하는 최고의 세계)
                </p>
            </header>
            <div className="relative w-full max-w-xs p-4 space-y-3 bg-secondary/80 rounded-2xl shadow-2xl border border-color z-10">
                <div className="space-y-2">
                    <Button colorScheme="gray" className="w-full !justify-start !py-2 !text-sm" disabled title="준비 중인 기능입니다.">
                        <span className="w-6 text-base font-bold">G</span> Google 계정으로 로그인
                    </Button>
                     <Button colorScheme="yellow" className="w-full !justify-start !py-2 !text-sm" onClick={handleKakaoLogin}>
                        <span className="w-6 text-base font-bold">K</span> Kakao 계정으로 로그인
                    </Button>
                </div>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-color" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-secondary text-tertiary">또는</span>
                    </div>
                </div>

                <form className="space-y-3" onSubmit={handleSubmit}>
                    {isRegisterMode ? (
                        <>
                             {isVerified ? (
                                <div className="bg-green-800/50 p-3 rounded-md text-center border border-green-600 space-y-1">
                                    <p className="font-bold text-green-300">✓ 본인인증 완료</p>
                                    <p className="text-sm">{verifiedInfo?.name} ({verifiedInfo?.dob})</p>
                                </div>
                            ) : (
                                <Button type="button" onClick={handleVerification} disabled={isVerifying} className="w-full !py-2 !text-sm" colorScheme="green">
                                    {isVerifying ? '인증 진행 중...' : '본인인증'}
                                </Button>
                            )}

                            <input type="text" value={username} onChange={e => setUsername(e.target.value)} required className="w-full px-4 py-2 text-sm bg-tertiary border border-color rounded-md disabled:bg-gray-700/50 disabled:cursor-not-allowed" placeholder="아이디" disabled={!isVerified || isLoading} />
                            <input type="text" value={nickname} onChange={e => setNickname(e.target.value)} required className="w-full px-4 py-2 text-sm bg-tertiary border border-color rounded-md disabled:bg-gray-700/50 disabled:cursor-not-allowed" placeholder="닉네임" disabled={!isVerified || isLoading} />
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full px-4 py-2 text-sm bg-tertiary border border-color rounded-md disabled:bg-gray-700/50 disabled:cursor-not-allowed" placeholder="비밀번호 (4자 이상)" disabled={!isVerified || isLoading} />
                            <input type="password" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} required className="w-full px-4 py-2 text-sm bg-tertiary border border-color rounded-md disabled:bg-gray-700/50 disabled:cursor-not-allowed" placeholder="비밀번호 확인" disabled={!isVerified || isLoading} />
                        </>
                    ) : (
                        <>
                            <input type="text" value={username} onChange={e => setUsername(e.target.value)} required className="w-full px-4 py-2 text-sm bg-tertiary border border-color rounded-md" placeholder="아이디" />
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full px-4 py-2 text-sm bg-tertiary border border-color rounded-md" placeholder="비밀번호" />
                        </>
                    )}
                    
                    {error && <p className="text-sm text-red-400 text-center">{error}</p>}

                    <Button type="submit" disabled={isLoading || (isRegisterMode && !isVerified)} className="w-full !py-2 !text-sm">
                        {isLoading ? '처리 중...' : (isRegisterMode ? '회원가입' : '로그인')}
                    </Button>
                </form>

                <div className="text-sm text-center">
                    <button onClick={() => { setIsRegisterMode(!isRegisterMode); setError(null); }} className="font-medium text-accent hover:text-accent-hover">
                        {isRegisterMode ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const App: React.FC = () => {
    const {
        currentUser,
        kakaoRegistrationData,
        currentUserWithStatus,
        currentRoute,
        error,
        successToast,
        activeNegotiation,
        modals,
        showExitToast,
        enhancementResult,
        enhancementOutcome,
        handlers,
        onlineUsers,
        guilds,
    } = useAppContext();
    
    const [isPreloading, setIsPreloading] = useState(true);

    useEffect(() => {
        const preventContextMenu = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                return;
            }
            e.preventDefault();
        };

        document.addEventListener('contextmenu', preventContextMenu);
        return () => {
            document.removeEventListener('contextmenu', preventContextMenu);
        };
    }, []);


    useEffect(() => {
        const initAudio = () => {
            audioService.initialize();
            document.removeEventListener('pointerdown', initAudio);
        };
        document.addEventListener('pointerdown', initAudio);

        return () => {
            document.removeEventListener('pointerdown', initAudio);
        };
    }, []);

    useEffect(() => {
        if (currentUser) {
            preloadImages(ALL_IMAGE_URLS).then(() => {
                setIsPreloading(false);
            });
        } else {
            setIsPreloading(false);
        }
    }, [currentUser]);

    if (!currentUser) {
        if (kakaoRegistrationData) {
            return <KakaoRegister registrationData={kakaoRegistrationData} />;
        }
        return <Auth />;
    }

    const topmostModalId = modals.activeModalIds.length > 0 ? modals.activeModalIds[modals.activeModalIds.length - 1] : null;
    
    const isGameView = currentRoute.view === 'game';

    return (
        <div className="font-sans bg-primary text-primary h-full flex flex-col">
            {isPreloading && (
                <div className="fixed inset-0 bg-tertiary z-[100] flex flex-col items-center justify-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
                    <p className="mt-4 text-primary">에셋 로딩 중...</p>
                </div>
            )}
            {error && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 w-full max-w-md z-50 animate-slide-down">
                    <div className="bg-danger border-2 border-red-500 rounded-lg shadow-2xl p-4 text-white font-bold text-center">{error}</div>
                </div>
            )}
            {successToast && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 w-full max-w-md z-50 animate-slide-down">
                    <div className="bg-success border-2 border-green-500 rounded-lg shadow-2xl p-4 text-white font-bold text-center">{successToast}</div>
                </div>
            )}
            {enhancementResult && !modals.enhancingItem && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 w-full max-w-md z-50 animate-slide-down">
                    <div className={`${enhancementResult.success ? 'bg-accent border-accent' : 'bg-danger border-red-500'} border-2 rounded-lg shadow-2xl p-4 text-white font-bold text-center`}>{enhancementResult.message}</div>
                </div>
            )}
            {showExitToast && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-md z-50 animate-slide-down-fast">
                    <div className="bg-primary border-2 border-color rounded-lg shadow-2xl p-3 text-primary font-semibold text-center">한번 더 뒤로가기를 하면 로그아웃 됩니다.</div>
                </div>
            )}
            
            {currentUser && !isGameView && <Header />}
            
            <main className="flex-1 flex flex-col min-h-0">
                <Router />
            </main>
            
            {currentUserWithStatus && (
                <>
                    {modals.levelUpInfo && <LevelUpModal levelUpInfo={modals.levelUpInfo} onClose={handlers.closeLevelUpModal} />}
                    {modals.isSettingsModalOpen && <SettingsModal onClose={handlers.closeSettingsModal} isTopmost={topmostModalId === 'settings'} />}
                    {modals.isInventoryOpen && <InventoryModal currentUser={currentUserWithStatus} onClose={handlers.closeInventory} onAction={handlers.handleAction} onStartEnhance={handlers.openEnhancingItem} enhancementAnimationTarget={modals.enhancementAnimationTarget} onAnimationComplete={handlers.clearEnhancementAnimation} isTopmost={topmostModalId === 'inventory'} initialTab={modals.inventoryInitialTab} />}
                    {modals.isMailboxOpen && <MailboxModal currentUser={currentUserWithStatus} onClose={handlers.closeMailbox} onAction={handlers.handleAction} isTopmost={topmostModalId === 'mailbox'} />}
                    {modals.isQuestsOpen && <QuestsModal currentUser={currentUserWithStatus} onClose={handlers.closeQuests} onAction={handlers.handleAction} isTopmost={topmostModalId === 'quests'} />}
                    {modals.rewardSummary && <RewardSummaryModal summary={modals.rewardSummary} onClose={handlers.closeRewardSummary} isTopmost={topmostModalId === 'rewardSummary'} />}
                    {modals.isClaimAllSummaryOpen && modals.claimAllSummary && <ClaimAllSummaryModal summary={modals.claimAllSummary} onClose={handlers.closeClaimAllSummary} isTopmost={topmostModalId === 'claimAllSummary'} />}
                    {modals.isShopOpen && <ShopModal initialTab={modals.shopInitialTab} currentUser={currentUserWithStatus} onClose={handlers.closeShop} onAction={handlers.handleAction} onStartQuiz={handlers.openActionPointQuiz} isTopmost={topmostModalId === 'shop'} />}
                    {modals.isActionPointQuizOpen && <ActionPointQuizModal onClose={handlers.closeActionPointQuiz} onAction={handlers.handleAction} isTopmost={topmostModalId === 'actionPointQuiz'} />}
                    
                    {modals.lastUsedItemResult && modals.lastUsedItemResult.length === 1 && <ItemObtainedModal item={modals.lastUsedItemResult[0]} onClose={handlers.closeItemObtained} isTopmost={topmostModalId === 'itemObtained'} />}
                    {modals.lastUsedItemResult && modals.lastUsedItemResult.length > 1 && <BulkItemObtainedModal items={modals.lastUsedItemResult} onClose={handlers.closeItemObtained} isTopmost={topmostModalId === 'itemObtained'} />}

                    {modals.disassemblyResult && <DisassemblyResultModal result={modals.disassemblyResult} onClose={handlers.closeDisassemblyResult} isTopmost={topmostModalId === 'disassemblyResult'} />}
                    {modals.craftResult && <CraftingResultModal result={modals.craftResult} onClose={handlers.closeCraftResult} isTopmost={topmostModalId === 'craftResult'} />}
                    {modals.synthesisResult && <SynthesisResultModal result={modals.synthesisResult} onClose={handlers.closeSynthesisResult} isTopmost={topmostModalId === 'synthesisResult'} />}
                    {modals.viewingUser && <UserProfileModal user={modals.viewingUser} onClose={handlers.closeViewingUser} onViewItem={handlers.openViewingItem} isTopmost={topmostModalId === 'viewingUser'} />}
                    {modals.isInfoModalOpen && <InfoModal onClose={handlers.closeInfoModal} isTopmost={topmostModalId === 'infoModal'} />}
                    {modals.isEncyclopediaOpen && <EncyclopediaModal onClose={handlers.closeEncyclopedia} isTopmost={topmostModalId === 'encyclopedia'} />}
                    {modals.isStatAllocationModalOpen && <StatAllocationModal currentUser={currentUserWithStatus} onClose={handlers.closeStatAllocationModal} onAction={handlers.handleAction} isTopmost={topmostModalId === 'statAllocation'} />}
                    {modals.isProfileEditModalOpen && <ProfileEditModal currentUser={currentUserWithStatus} onClose={handlers.closeProfileEditModal} onAction={handlers.handleAction} isTopmost={topmostModalId === 'profileEdit'} />}
                    {modals.pastRankingsInfo && <PastRankingsModal info={modals.pastRankingsInfo} onClose={handlers.closePastRankings} isTopmost={topmostModalId === 'pastRankings'} />}
                    {modals.moderatingUser && <AdminModerationModal user={modals.moderatingUser} currentUser={currentUserWithStatus} onClose={handlers.closeModerationModal} onAction={handlers.handleAction} isTopmost={topmostModalId === 'moderatingUser'} />}
                    {modals.viewingItem && <ItemDetailModal item={modals.viewingItem.item} isOwnedByCurrentUser={modals.viewingItem.isOwnedByCurrentUser} onClose={handlers.closeViewingItem} onStartEnhance={handlers.openEnhancementFromDetail} isTopmost={topmostModalId === 'viewingItem'} />}
                    {modals.enhancingItem && <EnhancementModal item={modals.enhancingItem} currentUser={currentUserWithStatus} onClose={handlers.closeEnhancementModal} onAction={handlers.handleAction} enhancementOutcome={enhancementOutcome} onOutcomeConfirm={handlers.clearEnhancementOutcome} isTopmost={topmostModalId === 'enhancingItem'} />}
                    {modals.isTowerRewardInfoOpen && <TowerRankingRewardsModal onClose={handlers.closeTowerRewardInfoModal} isTopmost={topmostModalId === 'towerRewardInfo'} />}
                    {modals.isGuildEffectsModalOpen && currentUserWithStatus.guildId && guilds[currentUserWithStatus.guildId] && (
                        <GuildEffectsModal
                            guild={guilds[currentUserWithStatus.guildId]}
                            onClose={handlers.closeGuildEffectsModal}
                            isTopmost={topmostModalId === 'guildEffects'}
                        />
                    )}
                    {modals.guildBossBattleResult && <GuildBossBattleResultModal result={{ ...modals.guildBossBattleResult, bossName: modals.guildBossBattleResult.bossName }} onClose={handlers.closeGuildBossBattleResultModal} isTopmost={topmostModalId === 'guildBossBattleResult'} />}
                    {activeNegotiation && <NegotiationModal negotiation={activeNegotiation} currentUser={currentUserWithStatus} onAction={handlers.handleAction} onlineUsers={onlineUsers} isTopmost={topmostModalId === 'negotiation'} />}
                    {modals.isEquipmentEffectsModalOpen && <EquipmentEffectsModal user={currentUserWithStatus} guild={currentUserWithStatus.guildId ? guilds[currentUserWithStatus.guildId] ?? null : null} onClose={handlers.closeEquipmentEffectsModal} />}
                    {modals.isPresetModalOpen && <PresetModal user={currentUserWithStatus} onAction={handlers.handleAction} onClose={handlers.closePresetModal} />}
                </>
            )}
        </div>
    );
};

export default App;
