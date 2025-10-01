
import React from 'react';
import { LiveGameSession, GameMode, GameType, Player } from '../../types/index.js';
import { SINGLE_PLAYER_STAGES, TOWER_STAGES } from '../../constants/index.js';
import { BLACK_PATTERN_STONE_IMG, WHITE_PATTERN_STONE_IMG } from '../../assets.js';
import Button from '../Button.js';

interface SinglePlayerIntroModalProps {
    session: LiveGameSession;
    onConfirm: () => void;
}

const gameTypeKorean: Record<GameType, string> = {
    'capture': '따내기',
    'survival': '살리기',
    'speed': '스피드',
    // FIX: Add missile and hidden to gameTypeKorean map
    'missile': '미사일',
    'hidden': '히든'
};

const CaptureTargetPanel: React.FC<{ target: number; label: string; isBlack: boolean }> = ({ target, label, isBlack }) => (
    <div className={`p-2 rounded-lg text-center flex flex-col justify-center ${isBlack ? 'bg-gray-800' : 'bg-gray-200'}`}>
        <span className={`text-xs font-semibold ${isBlack ? 'text-gray-300' : 'text-gray-600'}`}>{label}</span>
        <span className={`font-bold text-2xl ${isBlack ? 'text-white' : 'text-black'}`}>{target}</span>
    </div>
);

const SinglePlayerIntroModal: React.FC<SinglePlayerIntroModalProps> = ({ session, onConfirm }) => {
    const isTower = session.isTowerChallenge;
    const stageInfo = isTower
        ? TOWER_STAGES.find(s => s.id === session.stageId)
        : SINGLE_PLAYER_STAGES.find(s => s.id === session.stageId);

    if (!stageInfo) return null;

    let title = '';
    let description = '';
    let content: React.ReactNode = null;

    if (isTower) {
        if (stageInfo.floor! <= 20) {
            title = '도전의 탑 - 따내기 미션';
            description = `흑돌 ${session.blackStoneLimit}개 안에 목표를 달성하세요!`;
            content = (
                <div className="grid grid-cols-2 gap-4 my-4">
                    <CaptureTargetPanel target={session.effectiveCaptureTargets?.[Player.Black] || 0} label="나의 목표" isBlack={true} />
                    <CaptureTargetPanel target={session.effectiveCaptureTargets?.[Player.White] || 0} label="상대 목표" isBlack={false} />
                </div>
            );
        } else {
            title = '도전의 탑 - 계가 미션';
            description = `총 ${session.autoEndTurnCount}수 안에 AI보다 많은 집을 지으면 승리합니다.`;
            content = (
                <div className="bg-gray-800/50 p-3 rounded-md my-4">
                    <h4 className="font-semibold text-center mb-2">사용 가능 아이템</h4>
                    <div className="flex justify-around text-center">
                        <div><p>🚀</p><p>미사일: {session.settings.missileCount || 0}개</p></div>
                        <div><p>❓</p><p>히든: {session.settings.hiddenStoneCount || 0}개</p></div>
                        <div><p>🔍</p><p>스캔: {session.settings.scanCount || 0}개</p></div>
                    </div>
                </div>
            );
        }
    } else { // Single Player
        title = `${gameTypeKorean[stageInfo.gameType]} 미션`;
        
        switch (stageInfo.gameType) {
            case 'capture':
                description = '목표 개수만큼 상대 돌을 먼저 따내면 승리합니다.';
                content = (
                    <>
                        <div className="grid grid-cols-2 gap-4 my-4">
                            <CaptureTargetPanel target={session.effectiveCaptureTargets?.[Player.Black] || 0} label="나의 목표" isBlack={true} />
                            <CaptureTargetPanel target={session.effectiveCaptureTargets?.[Player.White] || 0} label="상대 목표" isBlack={false} />
                        </div>
                        <div className="text-xs text-gray-400 space-y-2">
                             <div className="flex items-center gap-2 bg-gray-800/50 p-2 rounded-md">
                                <div className="relative w-8 h-8 flex-shrink-0"><img src="/images/single/White.png" alt="백돌" className="w-full h-full" /><img src={WHITE_PATTERN_STONE_IMG} alt="백 문양돌" className="w-full h-full absolute top-0 left-0" /></div>
                                <span>문양이 있는 백돌을 잡으면 <strong className="text-yellow-300">2점</strong>을 얻습니다.</span>
                            </div>
                            <div className="flex items-center gap-2 bg-gray-800/50 p-2 rounded-md">
                                <div className="relative w-8 h-8 flex-shrink-0"><img src="/images/single/Black.png" alt="흑돌" className="w-full h-full" /><img src={BLACK_PATTERN_STONE_IMG} alt="흑 문양돌" className="w-full h-full absolute top-0 left-0" /></div>
                                <span>반대로 내 문양돌이 잡히면 <strong className="text-red-400">2점</strong>을 빼앗깁니다.</span>
                            </div>
                        </div>
                    </>
                );
                break;
            case 'survival':
                description = `백돌 ${session.whiteStoneLimit}개가 놓일 동안 살아남으면 승리합니다.`;
                break;
            case 'speed':
                description = `제한 시간 안에 대국을 승리해야 합니다. 착수 시마다 시간이 추가됩니다. ${session.autoEndTurnCount}수 후 자동 계가됩니다.`;
                break;
            case 'missile':
                description = `미사일 ${session.settings.missileCount}개를 활용하여 대국을 승리하세요. ${session.autoEndTurnCount}수 후 자동 계가됩니다.`;
                break;
            case 'hidden':
                description = `히든돌 ${session.settings.hiddenStoneCount}개와 스캔 ${session.settings.scanCount}개를 활용하여 승리하세요. ${session.autoEndTurnCount}수 후 자동 계가됩니다.`;
                break;
        }
    }

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-primary border-2 border-color rounded-lg shadow-xl p-6 w-full max-w-md text-center animate-fade-in">
                <h2 className="text-2xl font-bold text-highlight mb-2">{title}</h2>
                <p className="text-secondary mb-4">{description}</p>
                {content}
                <Button onClick={onConfirm} className="w-full mt-6">
                    대국 시작
                </Button>
            </div>
        </div>
    );
};

export default SinglePlayerIntroModal;