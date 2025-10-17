import React, { useState } from 'react';
import { GameMode } from '../types/index.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants.js';
import { strategicAiDisplayMap } from '../constants/gameSettings.js';
import BackButton from './BackButton.js';
import { useAppContext } from '../hooks/useAppContext.js';
import NineSlicePanel from './ui/NineSlicePanel.js';
import Button from './Button.js';

interface LobbyProps {
  lobbyType: 'strategic' | 'playful';
}

const GameCard: React.FC<{ mode: GameMode, description: string, image: string, available: boolean, onSelect: () => void, hoverColorClass: string }> = ({ mode, description, image, available, onSelect, hoverColorClass }) => {
    const [imgError, setImgError] = useState(false);

    return (
        <NineSlicePanel
            className={`text-on-panel flex flex-col text-center transition-all transform hover:-translate-y-1 shadow-lg ${hoverColorClass} ${!available ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            onClick={available ? onSelect : undefined}
            padding="p-3"
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
        </NineSlicePanel>
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

  const [selectedAiDifficulty, setSelectedAiDifficulty] = useState(1);

  const onBackToProfile = () => window.location.hash = '#/profile';

  const handleStartAiGame = (mode: GameMode) => {
    handlers.handleAction({ type: 'START_AI_GAME', payload: { mode, aiDifficulty: selectedAiDifficulty } });
  };

  return (
    <div className="bg-primary text-primary p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto h-full flex flex-col">
      <header className="flex flex-wrap justify-between items-center mb-8 gap-4 flex-shrink-0">
        <BackButton onClick={onBackToProfile} />
        <div className="text-center flex-grow">
          <h1 className="text-4xl font-bold">{title} 로비</h1>
          <p className="text-secondary mt-2">플레이할 게임을 선택하세요.</p>
        </div>
        <div className="w-24"></div> {/* Spacer to balance the back button */}
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto">
        <section>
          <h2 className={`text-2xl font-semibold mb-5 border-l-4 ${sectionBorderColor} pl-4`}>{sectionTitle}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* FIX: Corrected call to handlers.handleEnterWaitingRoom */}
            {modes.map(game => (
              <GameCard key={game.mode} {...game} available={gameModeAvailability[game.mode] ?? game.available} onSelect={() => handlers.handleEnterWaitingRoom(game.mode)} hoverColorClass={hoverColorClass} />
            ))}
          </div>
        </section>

        {/* NEW AI GAME SECTION */}
        <section className="mt-8">
          <h2 className={`text-2xl font-semibold mb-5 border-l-4 ${sectionBorderColor} pl-4`}>AI 대국</h2>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <label htmlFor="ai-difficulty" className="text-lg font-semibold">AI 난이도:</label>
              <select
                id="ai-difficulty"
                value={selectedAiDifficulty}
                onChange={(e) => setSelectedAiDifficulty(parseInt(e.target.value))}
                className="bg-tertiary border border-color rounded-md p-2 text-primary"
              >
                {strategicAiDisplayMap.map(level => (
                  <option key={level} value={level}>Lv.{level}</option>
                ))}
              </select>
            </div>
            <Button onClick={() => handleStartAiGame(modes[0].mode)} colorScheme="blue" className="w-48">AI 대국 시작</Button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Lobby;