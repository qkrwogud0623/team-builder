/**
 * @file statCalculationLogic.js
 * @description 경기 후 설문 결과를 바탕으로 선수의 6개 스탯을 자동으로 계산하는 로직
 */

const getPositionGroup = (rawPos) => {
    const p = String(rawPos || '').toUpperCase();
    if (p.includes('GK')) return 'GK';
    if (p.includes('CB') || p.includes('RB') || p.includes('LB') || p.includes('WB')) return 'DF';
    if (p.includes('CDM') || p.includes('CM') || p.includes('CAM') || p.includes('RM') || p.includes('LM') || p.includes('MF')) return 'MF';
    if (p.includes('ST') || p.includes('CF') || p.includes('RW') || p.includes('LW') || p.includes('FW')) return 'FW';
    return 'MF';
};

export const calculateStatChanges = (allSurveys, players, matchResult) => {

    const _calculateTeamAverageScores = (teamSurveys) => {
        if (!teamSurveys || teamSurveys.length === 0) {
            return { attack: 3, defense: 3, passing: 3, physical: 3, finishing: 3 };
        }
        const totalScores = { attack: 0, defense: 0, passing: 0, physical: 0, finishing: 0 };
        teamSurveys.forEach(s => {
            totalScores.attack += (s.q3_formationEffectiveness || 0);
            totalScores.defense += (s.cohesion_lineSpacing || 0) + (s.tactical_execution || 0);
            totalScores.passing += (s.q9_keypassSuccess || 0) + (s.q10_forwardPass || 0) - (s.q5_touchMiss || 0);
            totalScores.physical += (s.offTheBall_findSpace || 0) + (s.psych_stamina || 0);
            totalScores.finishing += (s.q6_shootingAccuracy || 0) + (s.q7_shootingAttempt || 0);
        });
        const numSurveys = teamSurveys.length;
        return {
            attack: totalScores.attack / numSurveys,
            defense: totalScores.defense / (numSurveys * 2),
            passing: totalScores.passing / numSurveys,
            physical: totalScores.physical / (numSurveys * 2),
            finishing: totalScores.finishing / (numSurveys * 2),
        };
    };

    const _mapScoresToStatDeltas = (avgScores) => {
        const BASELINE = 3.0;
        const FACTOR = 0.2;
        return {
            SHO: (avgScores.finishing - BASELINE) * FACTOR,
            DRI: (avgScores.attack - BASELINE) * (FACTOR / 2),
            DEF: (avgScores.defense - BASELINE) * FACTOR,
            PAS: ((avgScores.passing - BASELINE) + (avgScores.attack - BASELINE)) * (FACTOR / 2),
            PHY: ((avgScores.physical - BASELINE) + (avgScores.defense - BASELINE)) * (FACTOR / 2),
            PAC: (avgScores.physical - BASELINE) * FACTOR,
        };
    };

    const _getPositionalWeights = (position) => {
        const group = getPositionGroup(position);
        switch (group) {
            case 'FW': return { SHO: 1.0, DRI: 1.0, PAC: 1.0, PAS: 0.5, PHY: 0.5, DEF: 0.1 };
            case 'MF': return { PAS: 1.0, DRI: 1.0, PHY: 1.0, SHO: 0.5, PAC: 0.5, DEF: 0.5 };
            case 'DF': return { DEF: 1.0, PHY: 1.0, PAC: 1.0, PAS: 0.5, DRI: 0.1, SHO: 0.1 };
            default: return { SHO: 0, DRI: 0, DEF: 0, PAS: 0, PHY: 0, PAC: 0 };
        }
    };

    const surveysA = allSurveys.filter(s => s.team === 'A');
    const surveysB = allSurveys.filter(s => s.team === 'B');
    const avgScoresA = _calculateTeamAverageScores(surveysA);
    const avgScoresB = _calculateTeamAverageScores(surveysB);
    const baseDeltasA = _mapScoresToStatDeltas(avgScoresA);
    const baseDeltasB = _mapScoresToStatDeltas(avgScoresB);
    const getMultiplier = (teamLabel) => {
        const result = teamLabel === 'A' ? matchResult.teamA : matchResult.teamB;
        if (result === 'win') return 1.1;
        if (result === 'loss') return 0.9;
        return 1.0;
    };
    const multiplierA = getMultiplier('A');
    const multiplierB = getMultiplier('B');

    const finalChanges = {};
    players.forEach(player => {
        if (getPositionGroup(player.pos) === 'GK') return;
        const baseDeltas = player.team === 'A' ? baseDeltasA : baseDeltasB;
        const multiplier = player.team === 'A' ? multiplierA : multiplierB;
        const weights = _getPositionalWeights(player.pos);
        const playerStatChange = { SHO: 0, DRI: 0, DEF: 0, PAS: 0, PHY: 0, PAC: 0 };
        for (const stat in playerStatChange) {
            playerStatChange[stat] = baseDeltas[stat] * weights[stat] * multiplier;
        }
        finalChanges[player.uid] = playerStatChange;
    });

    return finalChanges;
};