import React, { useState } from 'react';
import { GameMode } from '../types.js';
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
            className={`bg-panel text-on-panel rounded-lg p-5 flex flex-col text-center transition-all transform hover:-translate-y-1 shadow-lg ${hoverColorClass} ${!available ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            onClick={available ? onSelect : undefined}
        >
            <div className="w-full aspect-[4/3] bg-tertiary rounded-md mb-4 overflow-hidden shadow-inner">
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
                <h3 className="text-xl font-bold text-primary mb-2">{mode}</h3>
                <p className="text-tertiary text-sm flex-grow">{description}</p>
            </div>
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
    <div className="bg-primary text-primary p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <header className="flex flex-wrap justify-between items-center mb-8 gap-4">
        <Button onClick={onBackToProfile} colorScheme="gray">&larr; 프로필로</Button>
        <div className="text-center flex-grow">
          <h1 className="text-4xl font-bold">{title} 로비</h1>
          <p className="text-secondary mt-2">플레이할 게임을 선택하세요.</p>
        </div>
        <div className="w-24"></div> {/* Spacer to balance the back button */}
      </header>

      <main>
        <section>
          <h2 className={`text-2xl font-semibold mb-5 border-l-4 ${sectionBorderColor} pl-4`}>{sectionTitle}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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