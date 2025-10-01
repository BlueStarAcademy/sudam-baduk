import React, { useState, useEffect, useMemo } from 'react';
import { ServerAction } from '../../types/index.js';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';
import { TOWER_PROVERBS } from '../../constants/towerChallengeConstants.js';
// FIX: Corrected import path for constant.
import { GO_TERMS_BY_LEVEL } from '../../constants/singlePlayerConstants.js';
import { audioService } from '../../services/audioService.js';

interface ActionPointQuizModalProps {
    onClose: () => void;
    onAction: (action: ServerAction) => void;
    isTopmost?: boolean;
}

type Question = {
    question: string;
    options: string[];
    correctAnswer: string;
};

type Term = { term: string; meaning: string };

const generateQuizQuestions = (): Question[] => {
    // FIX: Correctly merge arrays of Term objects.
    const allTerms: Term[] = [
        // FIX: Add null check for TOWER_PROVERBS before spreading
        ...(TOWER_PROVERBS || []),
        ...Object.values(GO_TERMS_BY_LEVEL).flat(),
    ];
    
    const shuffledTerms = [...allTerms].sort(() => 0.5 - Math.random());
    const selectedTerms = shuffledTerms.slice(0, 10);

    return selectedTerms.map((term: Term) => {
        const question = term.meaning;
        const correctAnswer = term.term;

        // Find similar terms for wrong answers based on level or just randomly
        const wrongAnswersPool = shuffledTerms.filter((t: Term) => t.term !== correctAnswer);
        const wrongAnswers = wrongAnswersPool.slice(0, 3).map((t: Term) => t.term);
        
        const options = [...wrongAnswers, correctAnswer].sort(() => 0.5 - Math.random());
        
        return {
            question,
            options,
            correctAnswer,
        };
    });
};

const ActionPointQuizModal: React.FC<ActionPointQuizModalProps> = ({ onClose, onAction, isTopmost }) => {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [wrongAnswers, setWrongAnswers] = useState(0);
    const [isQuizOver, setIsQuizOver] = useState(false);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [showFeedback, setShowFeedback] = useState(false);

    useEffect(() => {
        setQuestions(generateQuizQuestions());
    }, []);

    const handleAnswer = (answer: string) => {
        if (showFeedback) return;

        setSelectedAnswer(answer);
        setShowFeedback(true);

        if (answer === questions[currentQuestionIndex].correctAnswer) {
            setScore(prev => prev + 1);
            audioService.claimReward();
        } else {
            setWrongAnswers(prev => prev + 1);
            audioService.enhancementFail();
        }

        setTimeout(() => {
            setShowFeedback(false);
            setSelectedAnswer(null);
            if (currentQuestionIndex < questions.length - 1) {
                setCurrentQuestionIndex(prev => prev + 1);
            } else {
                setIsQuizOver(true);
            }
        }, 1500);
    };

    const handleClaim = () => {
        onAction({ type: 'CLAIM_ACTION_POINT_QUIZ_REWARD', payload: { score } });
        onClose();
    };

    const handleClose = () => {
        if (!isQuizOver) {
            if (window.confirm('퀴즈를 중단하시겠습니까? 현재까지의 점수만 보상으로 지급되며, 일일 응시 횟수가 차감됩니다.')) {
                handleClaim();
            }
        } else {
            onClose();
        }
    };

    const renderQuiz = () => {
        if (questions.length === 0 || !questions[currentQuestionIndex]) {
            return <p>퀴즈를 불러오는 중...</p>;
        }
        const currentQuestion = questions[currentQuestionIndex];
        return (
            <div>
                <div className="text-center mb-4 flex justify-around text-lg">
                    <span className="font-bold text-green-400">정답: {score}</span>
                    <span className="font-bold text-red-400">오답: {wrongAnswers}</span>
                </div>
                <div className="text-center mb-4">
                    <p className="text-sm text-gray-400">문제 {currentQuestionIndex + 1} / {questions.length}</p>
                    <h2 className="text-xl font-bold my-2 bg-blue-900/50 p-3 rounded-md min-h-[80px] flex items-center justify-center">{currentQuestion.question}</h2>
                    <p className="text-gray-300">위 설명에 해당하는 바둑 용어는?</p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                    {currentQuestion.options.map((option, index) => {
                        let buttonColor: 'blue' | 'green' | 'red' | 'gray' = 'blue';
                        if (showFeedback) {
                            if (option === currentQuestion.correctAnswer) {
                                buttonColor = 'green';
                            } else if (option === selectedAnswer) {
                                buttonColor = 'red';
                            } else {
                                buttonColor = 'gray';
                            }
                        }
                        return (
                            <Button
                                key={index}
                                onClick={() => handleAnswer(option)}
                                colorScheme={buttonColor}
                                disabled={showFeedback}
                                className="w-full !justify-center !p-4 !text-base"
                            >
                                {option}
                            </Button>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderResult = () => (
        <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">퀴즈 결과</h2>
            <p className="text-xl">
                <span className="font-bold text-yellow-300">{questions.length}</span>문제 중 <span className="font-bold text-green-400">{score}</span>개를 맞혔습니다!
            </p>
            <div className="my-6 p-4 bg-gray-900/50 rounded-lg">
                <p className="text-lg">획득한 행동력</p>
                <p className="text-5xl font-bold text-green-400 my-2">⚡ {score * 3}</p>
            </div>
            <Button onClick={handleClaim} colorScheme="green" className="w-full">보상 받기</Button>
        </div>
    );

    return (
        <DraggableWindow title="바둑 퀴즈" onClose={handleClose} windowId="action-point-quiz" initialWidth={500} isTopmost={isTopmost}>
            <div className="h-[calc(var(--vh,1vh)*60)] flex flex-col">
                {isQuizOver ? renderResult() : renderQuiz()}
            </div>
        </DraggableWindow>
    );
};

export default ActionPointQuizModal;