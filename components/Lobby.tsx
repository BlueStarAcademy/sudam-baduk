import React, { useState } from 'react';
import { GameMode } from '../types/index.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants.js';
import Button from './Button.js';
import { useAppContext } from '../hooks/useAppContext.js';

interface LobbyProps {
  lobbyType: 'strategic' | 'playful';
}

const GameCard: React.FC<{ mode: GameMode, description: string, image: string, available: boolean, onSelect: () => void, hoverColorClass: string }> = ({ mode, description, image, available, onSelect, hoverColorClass }) => {
    const [imgError, setImgError] = useState(false);

    return (
        <div
            className={`bg-panel text-on-panel rounded-lg p-3 flex flex-col text-center transition-all transform hover:-translate-y-1 shadow-lg ${hoverColorClass} ${!available ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} panel-glow`}
            onClick={available ? onSelect : undefined}
        >
            <div className="w-full aspect-[4/3] bg-tertiary rounded-md mb-2 overflow-hidden shadow-inner">
                {!imgError ? (
                    <img 
                        src={image} 
                        alt={mode} 
                        className="w-full h-full object-cover" 
                        onError={() => setImgError(true)} 
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-tertiary">
                        <span className="text-xs">{mode}</span>
                    </div>
                )}
            </div>
            <div className="flex-grow flex flex-col">
                <h3 className="text-lg font-bold text-primary mb-1">{mode}</h3>
                <p className="text-tertiary text-sm flex-grow">{description}</p>
            </div>
        </div>
    );
};

const LobbyRules: React.FC = () => {
  const rules = [
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
    <div className="bg-tertiary/50 rounded-lg p-4 mb-6 animate-pulse-border-yellow">
      <h2 className="text-xl font-bold text-highlight mb-3 text-center">대국실 이용 규칙</h2>
      <ol className="list-decimal list-inside space-y-1 text-sm text-secondary">
        {rules.map((rule, index) => (
          <li key={index}>{rule}</li>
        ))}
      </ol>
    </div>
  );
};


const Lobby: React.FC<LobbyProps> = ({ lobbyType }) => {
  const { gameModeAvailability, handlers } = useAppContext();

  const isStrategic = lobbyType === 'strategic';
  const title = isStrategic ? '전략 바둑' : '놀이 바둑';
  const modes = isStrategic ? SPECIAL_GAME_MODES : PLAYFUL_GAME_MODES;
  const sectionTitle = isStrategic ? '전략 바둑' : '놀이 바둑';
  const sectionBorderColor = isStrategic ? 'border-blue-400' : 'border-yellow-400';
  const hoverColorClass = isStrategic ? 'hover:shadow-blue-500/20' : 'hover:shadow-yellow-500/20';

  const onBackToProfile = () => window.location.hash = '#/profile';

  return (
    <div className="bg-primary text-primary p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto h-full flex flex-col">
      <header className="flex flex-wrap justify-between items-center mb-8 gap-4 flex-shrink-0">
        <Button onClick={onBackToProfile} colorScheme="gray">&larr; 프로필로</Button>
        <div className="text-center flex-grow">
          <h1 className="text-4xl font-bold">{title} 로비</h1>
          <p className="text-secondary mt-2">플레이할 게임을 선택하세요.</p>
        </div>
        <div className="w-24"></div> {/* Spacer to balance the back button */}
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto">
        <LobbyRules />
        <section>
          <h2 className={`text-2xl font-semibold mb-5 border-l-4 ${sectionBorderColor} pl-4`}>{sectionTitle}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {modes.map(game => (
              <GameCard key={game.mode} {...game} available={gameModeAvailability[game.mode] ?? game.available} onSelect={() => handlers.handleEnterWaitingRoom(game.mode)} hoverColorClass={hoverColorClass} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Lobby;