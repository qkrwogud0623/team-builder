/**
 * @file HomePage.jsx
 * @description
 * 로그인 후 사용자가 보게 되는 메인 화면입니다. (기존 MainScreen.jsx)
 * [개선] 사용자의 프로필 상태에 따라 '대표 선수 선택' 또는 '프로필' 화면을 렌더링합니다.
 * [개선] 경기 후 설문조사 로직을 최적화하고, 확인 모달 UX를 개선했습니다.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { updateDoc, setDoc, doc, deleteField, collection, query, where, getDocs, limit } from "firebase/firestore";
import { auth, db } from '../firebase';

// 하위 컴포넌트 및 스타일
import { PostMatchSurveyModal } from '../components/PostMatchSurveyModal';
import ConfirmModal from '../components/ConfirmModal'; // 새로 만든 확인 모달 import
import styles from './HomePage.module.css';

// --- 하위 UI 컴포넌트 (변경 없음) ---
const PlayerSelection = ({ recommendedPlayers, onSelectPlayer }) => (
    <div className={styles.choiceContainer}>
        <div className={styles.choiceContent}>
            <h2 className={styles.choiceTitle}>분석 완료!</h2>
            <p className={styles.choiceSubtitle}>당신과 가장 유사한 선수를 선택해 프로필을 생성하세요.</p>
            <div className={styles.choiceListContainer}>
                {recommendedPlayers?.map((player, index) => (
                    <button key={index} className={styles.playerChoiceCard} onClick={() => onSelectPlayer(player)}>
                        <div className={styles.playerInfo}>
                            <span className={styles.playerName}>{player.name}</span>
                            <span className={styles.playerTeam}>{player.team}</span>
                        </div>
                        <div className={styles.playerOvr}>
                            <span>OVR</span>
                            <span>{player.ovr}</span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    </div>
);

const UserProfile = ({ profile, myOvr, onLogout, onRedoSurvey }) => {
    const navigate = useNavigate();
    const hasTeam = !!profile?.teamId;

    return (
        <div className={styles.mainContainer}>
            <header className={styles.mainHeader}>
                <h2>마이 프로필</h2>
                <button onClick={onLogout} className={styles.logoutButton}>로그아웃</button>
            </header>
            <div className={styles.profileContent}>
                <div className={`${styles.profileCard} ${styles.mainProfileCard}`}>
                    <div className={styles.playerInfo}>
                        <span className={styles.profileName}>{profile.realName}</span>
                        <span className={styles.playerTeam}>대표 선수: {profile.selectedPlayer.name}</span>
                    </div>
                    <div className={styles.playerOvr}>
                        <span>MY OVR</span>
                        <span>{myOvr}</span>
                    </div>
                </div>
                <div className={styles.statsGrid}>
                    {profile.stats && Object.entries(profile.stats).map(([stat, value]) => (
                        <div key={stat} className={styles.statItem}>
                            <span className={styles.statValue}>{value}</span>
                            <span className={styles.statName}>{stat.toUpperCase()}</span>
                        </div>
                    ))}
                </div>
                <div className={styles.menuContainer}>
                    <h3>팀 활동</h3>
                    {hasTeam ? (
                        <button className={styles.menuCard} onClick={() => navigate(`/team/${profile.teamId}`)}>
                            <h4>나의 팀</h4>
                            <p>팀 페이지로 이동하여 팀원과 경기 일정을 확인하세요.</p>
                        </button>
                    ) : (
                        <>
                            <Link to="/create-team" className={styles.menuCard}><h4>팀 생성하기</h4><p>새로운 팀을 만들고 팀원들을 초대하세요.</p></Link>
                            <Link to="/join-team" className={styles.menuCard}><h4>팀 참가하기</h4><p>초대 코드를 입력하여 기존 팀에 합류하세요.</p></Link>
                        </>
                    )}
                </div>
                <div className={styles.menuContainer}>
                    <h3>프로필 관리</h3>
                    <button className={styles.menuCard} onClick={onRedoSurvey}>
                        <h4>설문조사 다시하기</h4>
                        <p>나의 플레이 스타일을 다시 분석하고 새로운 프로필을 받습니다.</p>
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- 메인 컴포넌트 (로직 및 상태 관리 담당) ---

function HomePage({ userProfile }) {
    const navigate = useNavigate();
    const [surveyMatch, setSurveyMatch] = useState(null);
    const [isRedoModalOpen, setRedoModalOpen] = useState(false); // [개선] 설문 다시하기 모달 상태

    // 1. OVR 계산 (useMemo로 최적화)
    const myOvr = useMemo(() => {
        if (!userProfile) return 60;
        if (typeof userProfile.playerOvr === 'number') return userProfile.playerOvr;
        if (userProfile.stats) {
            const values = Object.values(userProfile.stats).map(Number).filter(n => !isNaN(n));
            if (values.length > 0) return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
        }
        return 60; // 기본값
    }, [userProfile]);

    // 2. 프로필 불완전 시 설문 페이지로 리디렉션
    useEffect(() => {
        if (!userProfile) return;
        const hasSelectedPlayer = !!userProfile.selectedPlayer;
        const hasRecommendations = Array.isArray(userProfile.recommendedPlayers) && userProfile.recommendedPlayers.length > 0;
        if (!hasSelectedPlayer && !hasRecommendations) {
            navigate("/survey");
        }
    }, [userProfile, navigate]);

    // 3. [개선] 경기 후 설문조사 확인 로직 최적화
    useEffect(() => {
        const checkForPendingSurveys = async () => {
            const uid = auth.currentUser?.uid;
            const teamId = userProfile?.teamId;
            if (!uid || !teamId) return;

            // matches 컬렉션의 pendingSurveyParticipants 필드에 내 uid가 포함된 문서를 쿼리
            // 이렇게 하면 단 1번의 읽기 작업으로 필요한 경기를 찾을 수 있습니다.
            const matchesRef = collection(db, 'teams', teamId, 'matches');
            const q = query(
                matchesRef,
                where("pendingSurveyParticipants", "array-contains", uid),
                limit(1) // 가장 오래된 설문 1개만 가져옴
            );

            const matchesSnapshot = await getDocs(q);

            if (!matchesSnapshot.empty) {
                const matchDoc = matchesSnapshot.docs[0];
                setSurveyMatch({ id: matchDoc.id, ...matchDoc.data() });
            }
        };

        if (userProfile?.teamId) {
            checkForPendingSurveys();
        }
    }, [userProfile]);


    // --- 이벤트 핸들러 ---
    const handleLogout = () => {
        signOut(auth).catch(error => console.error("Logout Error:", error));
    };

    const handlePlayerSelection = async (player) => {
        const user = auth.currentUser;
        if (!user || !player) return;

        try {
            const userDocRef = doc(db, "users", user.uid);
            await updateDoc(userDocRef, { selectedPlayer: player });
            
            const teamId = userProfile?.teamId;
            const newPos = player?.position || player?.pos || null;
            if (teamId && newPos) {
                const memberRef = doc(db, "teams", teamId, "members", user.uid);
                await setDoc(memberRef, { position: newPos }, { merge: true });
            }
        } catch (error) {
            console.error("Player selection failed:", error);
            alert("선수 선택 중 오류가 발생했습니다.");
        }
    };

    // [개선] 설문 다시하기 로직 (모달 사용)
    const handleConfirmRedoSurvey = async () => {
        setRedoModalOpen(false); // 모달 닫기
        const user = auth.currentUser;
        if (!user) return;

        try {
            const userDocRef = doc(db, "users", user.uid);
            await updateDoc(userDocRef, {
                surveyCompleted: false,
                stats: deleteField(),
                recommendedPlayers: deleteField(),
                selectedPlayer: deleteField(),
            });
            navigate("/survey");
        } catch (error) {
            console.error("Redo survey failed:", error);
            alert("프로필 초기화 중 오류가 발생했습니다.");
        }
    };

    // --- 렌더링 로직 ---
    if (!userProfile) {
        return <div className={styles.loadingContainer}>프로필 정보를 불러오는 중...</div>;
    }

    return (
        <>
            {/* 경기 후 설문 모달 */}
            {surveyMatch && (
                <PostMatchSurveyModal
                    teamId={userProfile.teamId}
                    match={surveyMatch}
                    userProfile={userProfile}
                    onClose={() => setSurveyMatch(null)}
                />
            )}

            {/* [개선] 설문 다시하기 확인 모달 */}
            {isRedoModalOpen && (
                <ConfirmModal
                    title="설문조사 다시하기"
                    message="정말로 다시 진행하시겠습니까? 스탯과 추천 선수 정보가 초기화됩니다."
                    onConfirm={handleConfirmRedoSurvey}
                    onClose={() => setRedoModalOpen(false)}
                />
            )}

            {/* 메인 컨텐츠 */}
            {userProfile.selectedPlayer ? (
                <UserProfile
                    profile={userProfile}
                    myOvr={myOvr}
                    onLogout={handleLogout}
                    onRedoSurvey={() => setRedoModalOpen(true)} // 버튼 클릭 시 모달 열기
                />
            ) : (
                <PlayerSelection
                    recommendedPlayers={userProfile.recommendedPlayers}
                    onSelectPlayer={handlePlayerSelection}
                />
            )}
        </>
    );
}

export default HomePage;