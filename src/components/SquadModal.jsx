/**
 * 스쿼드 관리 모달로 포메이션과 명단 편집을 담당한다.
 */
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { Dropdown } from "./Dropdown.jsx";
import * as logic from "../utils/squadLogic.js";
import styles from "./SquadModal.module.css";
import modalStyles from "./CreateMatchModal.module.css";

// 경기 상단 정보와 탭 전환을 제어한다.
const SquadHeader = ({
  match,
  page,
  setPage,
  formation,
  onFormationChange,
  onShuffle,
  onClose,
  avgOvr,
  canManage,
}) => {
  const whenStr = match?.when?.toDate
    ? new Intl.DateTimeFormat("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",

        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(match.when.toDate())
    : "-";

  return (
    <div className={`${modalStyles.header} ${styles.squadHeader}`}>
      <div className={styles.headerTop}>
        <h3 className={modalStyles.title}>스쿼드 관리</h3>

        <button className={modalStyles.closeButton} onClick={onClose}>
          ×
        </button>
      </div>

      <div className={styles.matchInfo}>{whenStr}</div>

      <div className={styles.tabs}>
        <button
          onClick={() => setPage(0)}
          className={page === 0 ? styles.activeTab : ""}
        >
          1팀
        </button>

        <button
          onClick={() => setPage(1)}
          className={page === 1 ? styles.activeTab : ""}
        >
          2팀
        </button>

        <button
          onClick={() => setPage(2)}
          className={page === 2 ? styles.activeTab : ""}
        >
          참가명단
        </button>
      </div>

      {page !== 2 && (
        <>
          <div className={styles.controls}>
            {canManage ? (
              <Dropdown
                value={formation}
                onChange={onFormationChange}
                options={["4-3-3", "4-4-2", "4-2-4"]}
                placeholder="포메이션"
              />
            ) : (
              <div className={styles.readOnlyFormation}>
                <span>포메이션</span>

                <span>{formation}</span>
              </div>
            )}

            {canManage && (
              <button className={styles.shuffleButton} onClick={onShuffle}>
                랜덤 편성
              </button>
            )}
          </div>

          <div className={styles.ovrSummary}>
            <span>1팀 평균 {avgOvr.A}</span>

            <span>2팀 평균 {avgOvr.B}</span>
          </div>
        </>
      )}
    </div>
  );
};

// 팀별 포지션 슬롯과 벤치를 렌더링한다.
const TeamPane = ({
  title,
  teamLabel,
  slots,
  bench,
  attendeesMap,
  pins,
  canManage,
  onPin,
  onUnpin,
}) => (
  <div className={styles.pane}>
    <div className={styles.paneHeader}>
      <span>{title}</span>

      {}
    </div>

    <div className={styles.slotList}>
      {slots.map((s, idx) => {
        const player = s.uid ? attendeesMap.get(s.uid) : null;

        const isPinnedToThisTeam = pins[s.uid] === teamLabel;

        return (
          <div key={`${s.slot}-${idx}`} className={styles.slotItem}>
            <div className={styles.slotPlayerInfo}>
              <span className={styles.slotPosition}>{s.slot}</span>

              <span className={styles.slotName}>
                {player ? logic.cleanName(player.name) : "미배정"}
              </span>

              {pins[s.uid] && !isPinnedToThisTeam && (
                <span className={styles.otherTeamPin}>
                  {pins[s.uid]}팀 고정
                </span>
              )}
            </div>

            <div className={styles.slotActions}>
              {player && canManage && (
                <button
                  className={`${styles.pinButton} ${isPinnedToThisTeam ? styles.pinned : ""}`}
                  title={isPinnedToThisTeam ? "고정 해제" : "이 팀에 고정"}
                  onClick={() =>
                    isPinnedToThisTeam
                      ? onUnpin(s.uid)
                      : onPin(s.uid, teamLabel)
                  }
                >
                  📌
                </button>
              )}

              <span className={styles.slotOvr}>
                {player ? player.ovr : "-"}
              </span>
            </div>
          </div>
        );
      })}
    </div>

    {bench.length > 0 && (
      <>
        <h4 className={styles.benchTitle}>벤치 ({bench.length})</h4>

        <div className={styles.benchList}>
          {bench.map((uid) => {
            const player = attendeesMap.get(uid);

            if (!player) return null;

            const isPinnedToThisTeam = pins[uid] === teamLabel;

            return (
              <div key={`bench-${uid}`} className={styles.slotItem}>
                <div className={styles.slotPlayerInfo}>
                  <span className={styles.slotName}>
                    {logic.cleanName(player.name)}
                  </span>

                  {pins[uid] && !isPinnedToThisTeam && (
                    <span className={styles.otherTeamPin}>
                      {pins[uid]}팀 고정
                    </span>
                  )}
                </div>

                <div className={styles.slotActions}>
                  {canManage && (
                    <button
                      className={`${styles.pinButton} ${isPinnedToThisTeam ? styles.pinned : ""}`}
                      title={isPinnedToThisTeam ? "고정 해제" : "이 팀에 고정"}
                      onClick={() =>
                        isPinnedToThisTeam
                          ? onUnpin(uid)
                          : onPin(uid, teamLabel)
                      }
                    >
                      📌
                    </button>
                  )}

                  <span className={styles.slotOvr}>{player.ovr}</span>
                </div>
              </div>
            );
          })}
        </div>
      </>
    )}
  </div>
);

// 전체 참석자 목록을 정렬해 보여준다.
const AttendeePane = ({ attendees }) => {
  const sorted = useMemo(
    () => [...attendees].sort((a, b) => (b.ovr || 0) - (a.ovr || 0)),
    [attendees],
  );

  return (
    <div className={styles.pane}>
      <div className={styles.paneHeader}>
        <span>참가 명단</span>

        <span>총 {attendees.length}명</span>
      </div>

      <div className={styles.slotList}>
        {sorted.map((p) => (
          <div key={p.uid} className={styles.slotItem}>
            <span className={styles.slotName}>{logic.cleanName(p.name)}</span>

            <span className={styles.slotOvr}>{p.ovr}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// 스쿼드 구성 모달을 포털로 렌더링한다.
export const SquadModal = ({
  open,
  onClose,
  teamId,
  match,
  attendees = [],
  canManage,
}) => {
  const [formationA, setFormationA] = useState("4-3-3");

  const [formationB, setFormationB] = useState("4-3-3");

  const [squad, setSquad] = useState({
    teams: { A: [], B: [] },
    slots: { A: [], B: [] },
    bench: { A: [], B: [] },
  });

  const [pins, setPins] = useState({});

  const [page, setPage] = useState(0);

  const attendeesMap = useMemo(
    () => new Map(attendees.map((p) => [p.uid, p])),
    [attendees],
  );

  const { avgOvr, currentSquad } = useMemo(() => {
    if (!squad || !squad.teams) {
      return { avgOvr: { A: 0, B: 0 }, currentSquad: squad };
    }

    const { teams } = squad;

    const newAvgOvr = {
      A: logic.getAverageOvr(teams.A, attendeesMap),

      B: logic.getAverageOvr(teams.B, attendeesMap),
    };

    return { avgOvr: newAvgOvr, currentSquad: squad };
  }, [squad, attendeesMap]);

  useEffect(() => {
    if (!open || !teamId || !match) return;

    const loadSquad = async () => {
      try {
        const ref = doc(
          db,
          "teams",
          teamId,
          "matches",
          match.id,
          "meta",
          "squad",
        );

        const snap = await getDoc(ref);

        if (snap.exists() && attendees.length > 0) {
          const data = snap.data();

          setFormationA(data.formationA || "4-3-3");

          setFormationB(data.formationB || "4-3-3");

          setPins(data.pins || {});

          setSquad(data);
        } else {
          setFormationA("4-3-3");

          setFormationB("4-3-3");

          setPins({});

          setSquad(logic.buildSquad(attendees, {}, "4-3-3", "4-3-3"));
        }
      } catch (e) {
        console.error("스쿼드 로드 실패:", e);
      }
    };

    loadSquad();
  }, [open, teamId, match, attendees.length]);

  useEffect(() => {
    if (!open || attendees.length === 0) return;

    setSquad(logic.buildSquad(attendees, pins, formationA, formationB));
  }, [pins, formationA, formationB]);

  const handleFormationChange = (newFormation, teamLabel) => {
    if (teamLabel === "A") setFormationA(newFormation);
    else setFormationB(newFormation);
  };

  const handleSave = async () => {
    if (!teamId || !match || !canManage) return;

    try {
      await setDoc(
        doc(db, "teams", teamId, "matches", match.id, "meta", "squad"),
        {
          ...currentSquad,

          formationA,

          formationB,

          pins,

          updatedAt: serverTimestamp(),

          by: auth.currentUser?.uid || null,
        },
      );

      alert("스쿼드를 저장했습니다.");

      onClose();
    } catch (e) {
      console.error("스쿼드 저장 실패:", e);

      alert("스쿼드 저장에 실패했습니다.");
    }
  };

  const handleShuffle = () => {
    const newSquad = logic.buildSquad(attendees, pins, formationA, formationB);

    setSquad(newSquad);
  };

  if (!open || !match) return null;

  return createPortal(
    <div className={modalStyles.overlay} onMouseDown={onClose}>
      <div
        className={modalStyles.content}
        style={{ height: "90vh", maxHeight: "700px" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <SquadHeader
          match={match}
          page={page}
          setPage={setPage}
          formation={page === 0 ? formationA : formationB}
          onFormationChange={(val) =>
            handleFormationChange(val, page === 0 ? "A" : "B")
          }
          onShuffle={handleShuffle}
          onClose={onClose}
          avgOvr={avgOvr}
          canManage={canManage}
        />

        <div
          className={modalStyles.body}
          style={{ overflowY: "auto", flex: 1 }}
        >
          {}

          {currentSquad.slots && page === 0 && (
            <TeamPane
              title="1팀"
              teamLabel="A"
              slots={currentSquad.slots.A}
              bench={currentSquad.bench.A}
              attendeesMap={attendeesMap}
              pins={pins}
              canManage={canManage}
              onPin={(uid, team) => setPins((p) => ({ ...p, [uid]: team }))}
              onUnpin={(uid) =>
                setPins((p) => {
                  const n = { ...p };
                  delete n[uid];
                  return n;
                })
              }
            />
          )}

          {currentSquad.slots && page === 1 && (
            <TeamPane
              title="2팀"
              teamLabel="B"
              slots={currentSquad.slots.B}
              bench={currentSquad.bench.B}
              attendeesMap={attendeesMap}
              pins={pins}
              canManage={canManage}
              onPin={(uid, team) => setPins((p) => ({ ...p, [uid]: team }))}
              onUnpin={(uid) =>
                setPins((p) => {
                  const n = { ...p };
                  delete n[uid];
                  return n;
                })
              }
            />
          )}

          {page === 2 && <AttendeePane attendees={attendees} />}
        </div>

        <div className={modalStyles.footer}>
          {canManage && (
            <button
              className={`${modalStyles.button} ${modalStyles.primary}`}
              onClick={handleSave}
            >
              저장
            </button>
          )}

          <button
            className={`${modalStyles.button} ${modalStyles.secondary}`}
            onClick={onClose}
          >
            닫기
          </button>
        </div>
      </div>
    </div>,

    document.body,
  );
};
