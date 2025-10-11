import React, { useState } from 'react';
import DraggableWindow from './DraggableWindow.js';
import { GAME_RULES } from '../gameRules.js';

interface InfoModalProps {
    onClose: () => void;
    isTopmost?: boolean;
}

type InfoTab = 'game' | 'level' | 'ranking' | 'equipment' | 'manner' | 'guild' | 'sp';

const InfoModal: React.FC<InfoModalProps> = ({ onClose, isTopmost }) => {
    const [activeTab, setActiveTab] = useState<InfoTab>('game');

    const tabs: { id: InfoTab; label: string }[] = [
        { id: 'game', label: '게임 모드' },
        { id: 'level', label: '레벨/스탯' },
        { id: 'ranking', label: '랭킹' },
        { id: 'equipment', label: '장비' },
        { id: 'manner', label: '매너' },
        { id: 'guild', label: '길드' },
        { id: 'sp', label: '싱글/타워' },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'game':
                const gameRoomRules = [
                    "새로고침 해도 로그아웃 되지 않습니다.",
                    "브라우저를 끄면 자동으로 로그아웃 처리됩니다.",
                    "한 PC에서는 한 아이디만 동시 접속 가능합니다.",
                    "다른 아이디 로그인 시, 기존 아이디는 로그아웃됩니다.",
                    "동일 아이디로 다른 기기에서 로그인 시, 기존 기기는 로그아웃됩니다.",
                    "경기 중 재접속 시, 해당 경기로 자동 복귀합니다.",
                    "경기 중 연결이 끊어지면 180초(3분)의 재접속 대기시간이 주어집니다.",
                    "경기 중 3회 이상 연결이 끊어지면 기권패 처리됩니다.",
                    "경기 초반(20수 이내) 고의적인 기권/종료 시 페널티가 부과됩니다.",
                    "전략바둑 초반(20수 이내) 3분 이상 무응답 시, 상대방은 페널티 없이 무효처리가 가능합니다.",
                    "대기실에서 30분 이상 활동이 없으면 '휴식 중' 상태로 변경됩니다."
                ];
                return (
                    <div className="space-y-4">
                        <div>
                            <h3 className="font-bold text-lg text-blue-300">전략 바둑</h3>
                            <p className="text-sm">클래식, 따내기, 히든 바둑 등 전통적인 규칙을 기반으로 한 모드입니다. 수읽기와 전략을 통해 승리를 쟁취하세요. 각 게임의 자세한 규칙은 대기실의 '?' 버튼을 눌러 확인할 수 있습니다.</p>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-yellow-300">놀이 바둑</h3>
                            <p className="text-sm">주사위 바둑, 알까기 등 운과 순발력이 필요한 캐주얼 모드입니다. 가볍게 즐기며 새로운 재미를 느껴보세요. 각 게임의 자세한 규칙은 대기실의 '?' 버튼을 눌러 확인할 수 있습니다.</p>
                        </div>
                         <div>
                            <h3 className="font-bold text-lg text-purple-300">자동대국 챔피언십</h3>
                            <p className="text-sm">AI 시뮬레이션으로 진행되는 자동 대회입니다. 자신의 능력치와 장비 세팅으로 가상의 선수들과 실력을 겨루고, 결과에 따라 보상을 획득하며 주간 경쟁 랭킹을 올릴 수 있습니다.</p>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-green-300">싱글플레이 / 도전의 탑</h3>
                            <p className="text-sm">다양한 조건이 걸린 스테이지를 AI 상대로 클리어해나가는 1인용 콘텐츠입니다. 싱글플레이는 바둑의 기초를, 도전의 탑은 고난도 챌린지를 제공합니다.</p>
                        </div>
                         <div>
                            <h3 className="font-bold text-lg text-red-300">길드 보스전</h3>
                            <p className="text-sm">길드원들과 협력하여 강력한 보스를 공략하는 레이드 콘텐츠입니다. 보스에게 입힌 피해량에 따라 개인 보상을, 보스 처치 시 모든 길드원이 보상을 받습니다.</p>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-gray-200 mt-6 pt-4 border-t border-gray-700">대국실 공통 규칙</h3>
                            <ul className="list-disc list-inside text-sm space-y-1 pl-2 mt-2">
                                {gameRoomRules.map((rule, index) => <li key={index}>{rule}</li>)}
                            </ul>
                        </div>
                    </div>
                );
            case 'level':
                return (
                    <div className="space-y-4">
                        <div>
                            <h3 className="font-bold text-lg text-gray-200">레벨 시스템</h3>
                            <p className="text-sm">전략/놀이 바둑을 플레이하면 각 분야의 경험치(XP)를 얻습니다. 경험치가 100% 차면 레벨이 오릅니다.</p>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-green-300">스탯 포인트</h3>
                            <ul className="list-disc list-inside text-sm space-y-1 pl-2">
                                <li>전략 레벨과 놀이 레벨이 1 오를 때마다 각각 <strong className="text-yellow-300">2포인트</strong>씩 보너스 스탯 포인트를 획득합니다.</li>
                                <li>프로필 화면의 '포인트 분배' 버튼을 눌러 6가지 핵심 능력치에 투자할 수 있습니다.</li>
                                <li>이 능력치들은 자동대국 챔피언십과 길드 보스전에서 캐릭터의 성능을 결정합니다.</li>
                            </ul>
                        </div>
                    </div>
                );
            case 'ranking':
                return (
                    <div className="space-y-4">
                        <div>
                            <h3 className="font-bold text-lg text-purple-300">시즌 랭킹 (게임 모드별)</h3>
                             <ul className="list-disc list-inside text-sm space-y-1 pl-2">
                                <li>시즌은 3개월 단위로 진행됩니다 (1/4분기, 2/4분기 등).</li>
                                <li>시즌 동안 각 게임 모드별로 <strong className="text-yellow-300">최소 20경기</strong>를 플레이해야 해당 모드의 랭킹 티어를 받을 자격이 주어집니다. (배치 경기)</li>
                                <li>20경기를 채우지 못한 모드는 시즌 종료 시 '새싹' 티어로 마감됩니다.</li>
                                <li>시즌 종료 시, 배치 경기를 완료한 플레이어들을 대상으로 랭킹 점수와 순위에 따라 티어가 결정되고 보상이 우편으로 지급됩니다.</li>
                                <li>새 시즌이 시작되면 모든 게임 모드의 전적(승/패)과 랭킹 점수가 초기화됩니다.</li>
                            </ul>
                        </div>
                         <div>
                            <h3 className="font-bold text-lg text-cyan-300">주간 경쟁 (챔피언십)</h3>
                            <ul className="list-disc list-inside text-sm space-y-1 pl-2">
                                <li>매주 월요일, 챔피언십 리그와 티어에 따라 15명의 경쟁 상대가 배정됩니다.</li>
                                <li>일주일간 자동대국 챔피언십에 참여하여 랭킹 점수를 획득하고, 경쟁자들 사이에서 순위를 높여야 합니다.</li>
                                <li>일주일이 지나면 순위에 따라 상위 리그로 승급, 잔류, 또는 하위 리그로 강등되며, 결과에 따라 다이아 보상이 지급됩니다.</li>
                            </ul>
                        </div>
                    </div>
                );
            case 'equipment':
                return (
                     <div className="space-y-4">
                        <div>
                            <h3 className="font-bold text-lg text-gray-200">장비 시스템</h3>
                            <p className="text-sm">부채, 바둑판 등 6가지 종류의 장비를 장착하여 캐릭터의 능력치를 강화할 수 있습니다. 장비는 일반, 고급, 희귀, 에픽, 전설, 신화 등급으로 나뉩니다.</p>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-cyan-300">강화</h3>
                            <p className="text-sm">재료를 사용하여 장비의 별 등급(★)을 최대 10성까지 높일 수 있습니다. 강화 성공 시 주옵션이 상승하고, 부옵션이 추가되거나 기존 부옵션이 랜덤하게 강화됩니다. +4, +7, +10 강화 시에는 주옵션이 2배로 상승합니다.</p>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-orange-300">분해</h3>
                            <p className="text-sm">사용하지 않는 장비를 분해하여 강화 재료를 획득할 수 있습니다. 분해 시 '대박'이 발생하면 2배의 재료를 얻습니다.</p>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-purple-300">합성</h3>
                            <p className="text-sm">같은 등급의 장비 3개를 합성하여 새로운 장비 1개를 획득합니다. 낮은 확률로 한 등급 높은 장비를 얻을 수 있습니다. 신화 등급 장비 3개를 합성하면 일정 확률로 '더블 신화 옵션'을 가진 특별한 장비가 등장합니다.</p>
                        </div>
                    </div>
                );
            case 'manner':
                return (
                    <div className="space-y-4">
                        <div>
                            <h3 className="font-bold text-lg text-gray-200">매너 등급 시스템</h3>
                            <p className="text-sm">매너 점수는 모든 게임 모드에서 통합 관리됩니다. '보통' 등급을 기준으로, 매너 플레이 시 점수가 오르고 비매너 행동(접속 종료, 시간 초과 등) 시 점수가 하락합니다. 등급에 따라 다양한 혜택 또는 페널티가 적용됩니다.</p>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-gray-200">등급별 점수 및 효과</h3>
                            <ul className="list-disc list-inside text-sm space-y-2 pl-2">
                                <li><span className="text-purple-400 font-semibold">마스터 (2000점 이상):</span> 능력치 보너스 포인트 +20 (등급 하락 시 회수)</li>
                                <li><span className="text-blue-400 font-semibold">프로 (1600점 ~ 1999점):</span> 장비 강화 성공 확률 +10%</li>
                                <li><span className="text-cyan-400 font-semibold">품격 (1200점 ~ 1599점):</span> 경기 승리 시 장비 상자 획득 확률 +10%</li>
                                <li><span className="text-teal-400 font-semibold">매우 좋음 (800점 ~ 1199점):</span> 경기 승리 시 골드 보상 +10%</li>
                                <li><span className="text-green-400 font-semibold">좋음 (400점 ~ 799점):</span> 최대 행동력 +10</li>
                                <li className="border-t border-gray-600 pt-2"><span className="text-gray-300 font-semibold">보통 (200점 ~ 399점):</span> 기본 상태</li>
                                <li className="border-t border-gray-600 pt-2"><span className="text-yellow-400 font-semibold">주의 (100점 ~ 199점):</span> 매너 액션 버튼 사용 시 매너 점수 +1 추가 회복</li>
                                <li><span className="text-orange-400 font-semibold">나쁨 (50점 ~ 99점):</span> 대국 보상 50% 감소</li>
                                <li><span className="text-red-500 font-semibold">매우 나쁨 (1점 ~ 49점):</span> 행동력 회복 속도 감소 (20분에 1)</li>
                                <li><span className="text-red-700 font-semibold">최악 (0점):</span> 최대 행동력 10%로 감소</li>
                            </ul>
                        </div>
                    </div>
                );
            case 'guild':
                 return (
                    <div className="space-y-4">
                        <div>
                            <h3 className="font-bold text-lg text-gray-200">길드</h3>
                            <p className="text-sm">다른 유저들과 함께 길드를 만들고 성장시키는 커뮤니티 콘텐츠입니다. 길드원들과 협력하여 다양한 혜택을 누릴 수 있습니다.</p>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-green-300">주요 활동</h3>
                            <ul className="list-disc list-inside text-sm space-y-2 pl-2">
                                <li><strong>출석 및 기부:</strong> 매일 출석하고 재화를 기부하여 길드 경험치, 연구 포인트, 그리고 개인 보상인 길드 코인을 획득할 수 있습니다.</li>
                                <li><strong>주간 임무:</strong> 길드원 전체가 협력하여 달성하는 주간 목표입니다. 달성 시 모든 길드원이 보상을 받을 수 있습니다.</li>
                                <li><strong>길드 연구소:</strong> 기부로 모은 연구 포인트를 사용하여 길드원 전체에게 적용되는 강력한 버프 효과를 연구할 수 있습니다.</li>
                                <li><strong>길드 상점:</strong> 길드 코인을 사용하여 특별한 장비 상자, 강화 재료, 소모품 등을 구매할 수 있습니다.</li>
                                <li><strong>길드 보스전:</strong> 매일 정해진 횟수만큼 강력한 보스에게 도전하여, 입힌 피해량에 따라 개인 보상을 받고 보스 처치 시 길드 전체 보상을 획득하는 레이드 콘텐츠입니다.</li>
                            </ul>
                        </div>
                    </div>
                 );
            case 'sp':
                return (
                    <div className="space-y-4">
                        <div>
                            <h3 className="font-bold text-lg text-green-300">싱글플레이</h3>
                            <p className="text-sm">바둑 용어와 전략을 배우며 단계별로 구성된 AI 스테이지를 클리어하는 1인용 콘텐츠입니다. 스테이지 최초 클리어 시 푸짐한 보상을 얻을 수 있으며, 반복 클리어도 가능합니다. 또한, '수련 과제'를 통해 시간이 지나면 자동으로 재화를 획득할 수 있습니다.</p>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-red-300">도전의 탑</h3>
                            <p className="text-sm">총 100층으로 구성된 고난도 챌린지 모드입니다. 각 층마다 까다로운 조건을 가진 AI를 상대로 승리하여 탑을 오르고, 최초 클리어 보상을 획득하세요. 매월 1일, 랭킹이 초기화되고 지난달의 최종 순위에 따라 특별 보상이 지급됩니다.</p>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <DraggableWindow title="도움말" onClose={onClose} windowId="info-modal" initialWidth={600} isTopmost={isTopmost}>
            <div className="h-[calc(var(--vh,1vh)*60)] flex flex-col">
                <div className="flex bg-gray-900/70 p-1 rounded-lg mb-4 flex-shrink-0">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${activeTab === tab.id ? 'bg-blue-600' : 'text-gray-400 hover:bg-gray-700/50'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div className="flex-grow overflow-y-auto pr-2 bg-gray-900/30 p-4 rounded-md">
                    {renderContent()}
                </div>
            </div>
        </DraggableWindow>
    );
};

export default InfoModal;