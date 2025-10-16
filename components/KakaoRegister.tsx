import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../hooks/useAppContext.js';
import Button from './Button.js';
import { TERMS_OF_SERVICE } from '../termsOfService.js';
import { containsProfanity } from '../profanity.js';

interface KakaoRegisterProps {
    registrationData: {
        kakaoId: string;
        suggestedNickname: string;
    };
}

const KakaoRegister: React.FC<KakaoRegisterProps> = ({ registrationData }) => {
    // FIX: Destructure 'handlers' to access the login function.
    const { handlers } = useAppContext();
    const [nickname, setNickname] = useState(registrationData.suggestedNickname);
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const termsRef = useRef<HTMLDivElement>(null);
    
    // Identity verification state
    const [isVerified, setIsVerified] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [verifiedInfo, setVerifiedInfo] = useState<{name: string, dob: string} | null>(null);

    useEffect(() => {
        if (termsRef.current) {
            termsRef.current.scrollTop = 0;
        }
    }, []);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!isVerified) {
            setError("본인인증을 먼저 완료해주세요.");
            return;
        }
        if (!nickname.trim() || nickname.trim().length < 2 || nickname.trim().length > 12) {
            setError("닉네임은 2자 이상 12자 이하로 입력해주세요.");
            return;
        }
        if (containsProfanity(nickname)) {
            setError("닉네임에 부적절한 단어가 포함되어 있습니다.");
            return;
        }
        if (!agreedToTerms) {
            setError("게임 이용 약관에 동의해야 합니다.");
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch('/api/auth/finalize-kakao', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    kakaoId: registrationData.kakaoId,
                    nickname: nickname.trim(),
                }),
            });
    
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || '등록 중 오류가 발생했습니다.');
            }
    
            const { user, sessionId } = await response.json();
            // FIX: Use handlers.login to call the login function from context.
            handlers.login(user, sessionId);
            // The useApp hook will see the new user and redirect to profile
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="relative h-full w-full flex flex-col items-center justify-center p-4 sm:p-8 bg-tertiary bg-[url('/images/bg/loginbg.png')] bg-cover bg-center">
            <div className="absolute inset-0 bg-black/60"></div>
            <div className="relative w-full max-w-lg p-6 space-y-4 bg-secondary/80 rounded-2xl shadow-2xl border border-color z-10">
                <h1 className="text-3xl font-bold text-center text-highlight">환영합니다!</h1>
                <p className="text-center text-primary">SUDAM에 처음 오셨군요. 사용할 닉네임을 정하고 약관에 동의해주세요.</p>

                <form className="space-y-4" onSubmit={handleSubmit}>
                    {isVerified ? (
                        <div className="bg-green-800/50 p-3 rounded-md text-center border border-green-600 space-y-1">
                            <p className="font-bold text-green-300">✓ 본인인증 완료</p>
                            <p className="text-sm">{verifiedInfo?.name} ({verifiedInfo?.dob})</p>
                        </div>
                    ) : (
                        <Button type="button" onClick={handleVerification} disabled={isVerifying} className="w-full !py-2 !text-base" colorScheme="green">
                            {isVerifying ? '인증 진행 중...' : '본인인증'}
                        </Button>
                    )}
                    
                    <div>
                        <label htmlFor="nickname" className="block mb-2 text-sm font-medium text-secondary">닉네임</label>
                        <input
                            type="text"
                            id="nickname"
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            className="w-full px-4 py-2 text-sm bg-tertiary border border-color rounded-md disabled:bg-gray-700/50 disabled:cursor-not-allowed"
                            placeholder="사용할 닉네임 (2-12자)"
                            maxLength={12}
                            minLength={2}
                            required
                            disabled={!isVerified || isLoading}
                        />
                    </div>

                    <div>
                        <label className="block mb-2 text-sm font-medium text-secondary">게임 이용 약관</label>
                        <div ref={termsRef} className="h-48 p-3 bg-tertiary border border-color rounded-md text-xs text-secondary overflow-y-auto whitespace-pre-wrap">
                            {TERMS_OF_SERVICE}
                        </div>
                        <label className={`flex items-center mt-3 ${!isVerified ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                            <input
                                type="checkbox"
                                checked={agreedToTerms}
                                onChange={(e) => setAgreedToTerms(e.target.checked)}
                                className="w-5 h-5 text-accent bg-secondary border-color rounded focus:ring-accent disabled:cursor-not-allowed"
                                disabled={!isVerified || isLoading}
                            />
                            <span className="ml-2 text-sm text-primary">게임 이용 약관에 동의합니다.</span>
                        </label>
                    </div>

                    {error && <p className="text-sm text-red-400 text-center">{error}</p>}

                    <Button type="submit" disabled={isLoading || !isVerified || !agreedToTerms} className="w-full !py-3 !text-base">
                        {isLoading ? '등록 중...' : '가입 완료 및 게임 시작'}
                    </Button>
                </form>
            </div>
        </div>
    );
};

export default KakaoRegister;