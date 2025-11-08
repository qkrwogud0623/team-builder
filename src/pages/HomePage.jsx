/**
 * @file HomePage.jsx
 * @description
 * [레전드 수정]
 * - '경기 후 설문조사' 로직이 'attendees' 목록을 불러오지 못하던 치명적 오류를 수정했습니다.
 * - surveyMatch state를 surveyData ({ match, attendees }) 객체로 변경하여 모달에 데이터를 올바르게 전달합니다.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { updateDoc, setDoc, doc, deleteField, collection, query, where, getDocs, getDoc, limit } from "firebase/firestore"; // [수정] getDoc 추가
import { auth, db } from '../firebase';

// 하위 컴포넌트 및 스타일
import { PostMatchSurveyModal } from '../components/PostMatchSurveyModal';
import ConfirmModal from '../components/ConfirmModal';
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
                    {profile.stats && 
                      ['DRI', 'PAC', 'PAS', 'PHY', 'SHO', 'DEF'].map((stat) => (
                        <div key={stat} className={styles.statItem}>
                            {/* 배열의 'stat' 이름(key)을 사용해 객체(profile.stats)에서 값을 찾음 */}
                            <span className={styles.statValue}>{profile.stats[stat] || 60}</span>
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
    // [레전드 수정] surveyMatch -> surveyData로 변경. { match, attendees } 객체를 저장.
    const [surveyData, setSurveyData] = useState(null);
    const [isRedoModalOpen, setRedoModalOpen] = useState(false);

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

    // 2. 프로필 불완전 시 설문 페이지로 리디렉션 (변경 없음)
    useEffect(() => {
        if (!userProfile) return;
        const hasSelectedPlayer = !!userProfile.selectedPlayer;
        const hasRecommendations = Array.isArray(userProfile.recommendedPlayers) && userProfile.recommendedPlayers.length > 0;
        if (!hasSelectedPlayer && !hasRecommendations) {
            navigate("/survey");
        }
    }, [userProfile, navigate]);

    // 3. [레전드 수정] 경기 후 설문조사 확인 (attendees 로직 추가)
    useEffect(() => {
        const checkForPendingSurveys = async () => {
            const uid = auth.currentUser?.uid;
            const teamId = userProfile?.teamId;
            if (!uid || !teamId) return;

            // 1. 내 팀의 경기 중, "완료" 상태이고 "설문 대기자"에 내가 포함된 경기를 찾음
            const matchesRef = collection(db, 'teams', teamId, 'matches');
            const q = query(
                matchesRef,
                where("pendingSurveyParticipants", "array-contains", uid),
                limit(1)
            );

            const matchesSnapshot = await getDocs(q);

            if (!matchesSnapshot.empty) {
                const matchDoc = matchesSnapshot.docs[0];
                const pendingMatch = { id: matchDoc.id, ...matchDoc.data() };

                // 2. [추가] 내가 이미 설문을 제출했는지 한 번 더 확인 (중복 방지)
                const surveyDocRef = doc(db, 'teams', teamId, 'matches', pendingMatch.id, 'surveys', uid);
                const surveySnap = await getDoc(surveyDocRef);

                // 3. 설문 제출 기록이 "없으면" 모달을 띄움
                if (!surveySnap.exists()) {
                    
                    // 4. [핵심] 모달에 넘겨줄 '참석자 목록(attendees)'을 만듦
                    const attRef = collection(db, 'teams', teamId, 'matches', pendingMatch.id, 'attendance');
                    const qYes = query(attRef, where("status", "==", "yes"));
                    const attSnap = await getDocs(qYes);
                    const yesUids = attSnap.docs.map(d => d.id);

                    if (yesUids.length === 0) return; // (이론상 발생 안함)

                    const userDocs = await Promise.all(yesUids.map(id => getDoc(doc(db, 'users', id))));
                    
                    const attendees = userDocs.map(userSnap => {
                        if (!userSnap.exists()) return null;
                        const u = userSnap.data();
                        
                        // OVR 계산 로직 (TeamPage와 동일하게)
                        let ovr = 60;
                        if (typeof u.playerOvr === 'number') ovr = u.playerOvr;
                        else if (u.stats) {
                            const vals = Object.values(u.stats).filter(v => typeof v === 'number');
                            if (vals.length > 0) ovr = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
                        }
                        return { uid: userSnap.id, name: u.realName, pos: u.position || 'CM', ovr: ovr };
                    }).filter(Boolean);

                    // 5. [수정] match와 attendees를 함께 state에 저장
                    setSurveyData({ match: pendingMatch, attendees: attendees });
                }
            }
        };

        if (userProfile?.teamId) {
            checkForPendingSurveys();
        }
    }, [userProfile]); // userProfile이 로드되거나 변경될 때 1회 실행


    // --- 이벤트 핸들러 (변경 없음) ---
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
 
    const handleConfirmRedoSurvey = async () => {
        setRedoModalOpen(false);
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
            {/* [레전드 수정] surveyData state를 사용하도록 변경 */}
            {surveyData && (
                <PostMatchSurveyModal
                    teamId={userProfile.teamId}
                    match={surveyData.match}
                    attendees={surveyData.attendees} /* [핵심] attendees 전달 */
                    userProfile={userProfile}
                    onClose={() => setSurveyData(null)} /* [수정] setSurveyData로 변경 */
                />
            )}

            {/* [개선] 설문 다시하기 확인 모달 (변경 없음) */}
            {isRedoModalOpen && (
                <ConfirmModal
                    title="설문조사 다시하기"
                    message="정말로 다시 진행하시겠습니까? 스탯과 추천 선수 정보가 초기화됩니다."
                    onConfirm={handleConfirmRedoSurvey}
                    onClose={() => setRedoModalOpen(false)}
                />
            )}

            {/* 메인 컨텐츠 (변경 없음) */}
            {userProfile.selectedPlayer ? (
                <UserProfile
                    profile={userProfile}
                    myOvr={myOvr}
                    onLogout={handleLogout}
                    onRedoSurvey={() => setRedoModalOpen(true)}
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