/**
 * 第二站第二題 單線圖（依官方控制電路圖重繪，改用本模擬器的器具與端子名稱）。
 * 控制電路：每個符號的腳位綁實體端子，由 schematic.test.ts 驗證與參考接線電氣一致。
 * 主電路：與第一題相同（正反轉 + Y-Δ），直接沿用並同樣做功能驗證。
 */
import type { SchDiagram } from '../schematic';
import { Q2_1_SCHEMATIC } from './q2-1.schematic';

const P = 70, N0 = 700;        // R 相（EMS 之後）／T 相 母線
const Q = 170, N1 = 610;       // TR3 之後的共同點／線圈共同線（TH-RY 之上）

export const Q2_2_SCHEMATIC: SchDiagram = {
  w: 1480, h: 730,
  syms: [
    // 電源、保險絲、EMS
    { id: 'srcR', dev: 'NFB', kind: 'src', x: 400, y: P, t: ['NFB.A'], label: 'R' },
    { id: 'srcT', dev: 'NFB', kind: 'src', x: 400, y: N0, t: ['NFB.C'], label: 'T' },
    { id: 'df1', dev: 'DF1', kind: 'fuse', x: 450, y: P, t: ['DF1.上', 'DF1.下'], label: 'D-F' },
    { id: 'df2', dev: 'DF2', kind: 'fuse', x: 450, y: N0, t: ['DF2.上', 'DF2.下'], label: 'D-F' },
    { id: 'ems', dev: 'EMS', kind: 'ems', x: 530, y: P, t: ['EMS.b上', 'EMS.b下'] },
    { id: 'thry', dev: 'THRY', kind: 'trip-nc', x: 600, y: 650, t: ['THRY.b', 'THRY.c'], label: 'TH-RY', note: '96-95' },
    // 正反轉
    { id: 'tr3', dev: 'TR3', kind: 'tf-nc', x: 600, y: 120, t: ['TR3.8', 'TR3.5'], note: '8-5' },
    { id: 'tr2b', dev: 'TR2', kind: 'tf-nc', x: 600, y: 210, t: ['TR2.8', 'TR2.5'], note: '8-5' },
    { id: 'tr2a', dev: 'TR2', kind: 'tf-no', x: 800, y: 210, t: ['TR2.8', 'TR2.6'], note: '8-6' },
    { id: 'fwd', dev: 'FWD', kind: 'pb-no', x: 640, y: 300, t: ['FWD.a上', 'FWD.a下'] },
    { id: 'rev', dev: 'REV', kind: 'pb-no', x: 680, y: 300, t: ['REV.a上', 'REV.a下'] },
    { id: 'mcfHold', dev: 'MCF', kind: 'no', x: 560, y: 300, t: ['MCF.a左上', 'MCF.a左下'], note: 'a左', left: true },
    { id: 'mcrHold', dev: 'MCR', kind: 'no', x: 750, y: 300, t: ['MCR.a左上', 'MCR.a左下'], note: 'a左' },
    { id: 'krFwd', dev: 'KR', kind: 'no', x: 800, y: 300, t: ['KR.1', 'KR.4'], note: '1-4' },
    { id: 'krRev', dev: 'KR', kind: 'nc', x: 860, y: 300, t: ['KR.1', 'KR.3'], note: '1-3' },
    { id: 'mcfCoil', dev: 'MCF', kind: 'coil', x: 560, y: 460, t: ['MCF.A1', 'MCF.A2'] },
    { id: 'krSC', dev: 'KR', kind: 'coil', x: 640, y: 460, t: ['KR.2', 'KR.10'], label: 'SC' },
    { id: 'krRC', dev: 'KR', kind: 'coil', x: 680, y: 460, t: ['KR.5', 'KR.7'], label: 'RC' },
    { id: 'mcrCoil', dev: 'MCR', kind: 'coil', x: 760, y: 460, t: ['MCR.A1', 'MCR.A2'] },
    { id: 'mcrLock', dev: 'MCR', kind: 'nc', x: 640, y: 550, t: ['MCR.b左上', 'MCR.b左下'], note: 'b左', left: true },
    { id: 'mcfLock', dev: 'MCF', kind: 'nc', x: 680, y: 550, t: ['MCF.b左上', 'MCF.b左下'], note: 'b左' },
    // Y-Δ
    { id: 'mcfRun', dev: 'MCF', kind: 'no', x: 900, y: 120, t: ['MCF.a右上', 'MCF.a右下'], note: 'a右', left: true },
    { id: 'mcrRun', dev: 'MCR', kind: 'no', x: 960, y: 120, t: ['MCR.a右上', 'MCR.a右下'], note: 'a右' },
    { id: 'tr1Coil', dev: 'TR1', kind: 'coil', x: 900, y: 460, t: ['TR1.2', 'TR1.7'], note: '2-7' },
    { id: 'tr1Y', dev: 'TR1', kind: 'td-nc', x: 960, y: 230, t: ['TR1.8', 'TR1.5'], note: '8-5' },
    { id: 'mcdLock', dev: 'MCD', kind: 'nc', x: 960, y: 330, t: ['MCD.b左上', 'MCD.b左下'], note: 'b左' },
    { id: 'mcsCoil', dev: 'MCS', kind: 'coil', x: 960, y: 460, t: ['MCS.A1', 'MCS.A2'] },
    { id: 'tr1D', dev: 'TR1', kind: 'td-no', x: 1020, y: 230, t: ['TR1.8', 'TR1.6'], note: '8-6' },
    { id: 'mcsLock', dev: 'MCS', kind: 'nc', x: 1020, y: 330, t: ['MCS.b左上', 'MCS.b左下'], note: 'b左' },
    { id: 'mcdCoil', dev: 'MCD', kind: 'coil', x: 1020, y: 460, t: ['MCD.A1', 'MCD.A2'] },
    // 指示燈
    { id: 'mcdLamp', dev: 'MCD', kind: 'no', x: 1080, y: 230, t: ['MCD.a左上', 'MCD.a左下'], note: 'a左' },
    { id: 'krR1', dev: 'KR', kind: 'no', x: 1080, y: 330, t: ['KR.11', 'KR.8'], note: '11-8', left: true },
    { id: 'krR3', dev: 'KR', kind: 'nc', x: 1140, y: 330, t: ['KR.11', 'KR.9'], note: '11-9' },
    { id: 'lampR1', dev: 'R1', kind: 'lamp', x: 1080, y: 460, t: ['R1.X1', 'R1.X2'] },
    { id: 'lampR3', dev: 'R3', kind: 'lamp', x: 1140, y: 460, t: ['R3.X1', 'R3.X2'] },
    { id: 'mcdR2', dev: 'MCD', kind: 'nc', x: 1200, y: 230, t: ['MCD.b右上', 'MCD.b右下'], note: 'b右' },
    { id: 'lampR2', dev: 'R2', kind: 'lamp', x: 1200, y: 460, t: ['R2.X1', 'R2.X2'] },
    // OFF（1a1b 都用）、TR3／TR2 線圈
    { id: 'offA', dev: 'OFF', kind: 'pb-no', x: 1280, y: 120, t: ['OFF.a上', 'OFF.a下'], label: 'OFF', note: 'a' },
    { id: 'offB', dev: 'OFF', kind: 'pb-nc', x: 1340, y: 120, t: ['OFF.b上', 'OFF.b下'], label: 'OFF', note: 'b' },
    { id: 'tr3Coil', dev: 'TR3', kind: 'coil', x: 1280, y: 460, t: ['TR3.2', 'TR3.7'], note: '2-7' },
    { id: 'mcdTr2', dev: 'MCD', kind: 'no', x: 1340, y: 230, t: ['MCD.a右上', 'MCD.a右下'], note: 'a右' },
    { id: 'tr2Coil', dev: 'TR2', kind: 'coil', x: 1340, y: 460, t: ['TR2.2', 'TR2.7'], note: '2-7' },
    // G
    { id: 'mcfG', dev: 'MCF', kind: 'nc', x: 1420, y: 150, t: ['MCF.b右上', 'MCF.b右下'], note: 'b右' },
    { id: 'mcrG', dev: 'MCR', kind: 'nc', x: 1420, y: 250, t: ['MCR.b右上', 'MCR.b右下'], note: 'b右' },
    { id: 'lampG', dev: 'G', kind: 'lamp', x: 1420, y: 460, t: ['G.X1', 'G.X2'] },
  ],
  wires: [
    // 母線
    [[400, P], [430, P]], [[470, P], [510, P]], [[550, P], [1420, P]],
    [[400, N0], [430, N0]], [[470, N0], [1420, N0]],
    [[600, N1], [1340, N1]],
    // TH-RY b：線圈共同線 → T 相
    [[600, 630], [600, N1]], [[600, 670], [600, N0]],
    // TR3 → Q → TR2 b → FWD／REV
    [[600, P], [600, 100]], [[600, 140], [600, Q]],
    [[560, Q], [800, Q]],
    [[600, Q], [600, 190]],
    [[600, 230], [600, 250], [680, 250], [680, 280]], [[640, 250], [640, 280]],
    // 自保
    [[560, Q], [560, 280]], [[750, Q], [750, 280]],
    // 正轉節點：FWD 下 → SC；MCF 自保下、MCF 線圈上、KR 1-4 下 併入
    [[640, 320], [640, 440]],
    [[560, 320], [560, 350], [640, 350]],
    [[560, 440], [560, 400], [640, 400]],
    [[800, 320], [800, 380], [640, 380]],
    // 反轉節點：REV 下 → RC；MCR 自保下、MCR 線圈上、KR 1-3 下 併入
    [[680, 320], [680, 440]],
    [[750, 320], [750, 350], [680, 350]],
    [[760, 440], [760, 410], [680, 410]],
    [[860, 320], [860, 425], [680, 425]],
    // TR2 a → KR 共用（1）
    [[800, Q], [800, 190]], [[800, 230], [800, 280]], [[800, 260], [860, 260], [860, 280]],
    // 線圈下端 → 互鎖 b → 共同線
    [[560, 480], [560, 500], [640, 500]], [[640, 480], [640, 530]], [[640, 570], [640, N1]],
    [[760, 480], [760, 500], [680, 500]], [[680, 480], [680, 530]], [[680, 570], [680, N1]],
    // Y-Δ
    [[900, P], [900, 100]], [[960, P], [960, 100]],
    [[900, 140], [900, Q], [1200, Q]], [[960, 140], [960, Q]],
    [[900, Q], [900, 440]],
    [[960, Q], [960, 210]], [[960, 250], [960, 310]], [[960, 350], [960, 440]],
    [[1020, Q], [1020, 210]], [[1020, 250], [1020, 310]], [[1020, 350], [1020, 440]],
    // 燈
    [[1080, Q], [1080, 210]], [[1080, 250], [1080, 310]], [[1080, 280], [1140, 280], [1140, 310]],
    [[1080, 350], [1080, 440]], [[1140, 350], [1140, 440]],
    [[1200, Q], [1200, 210]], [[1200, 250], [1200, 440]],
    // OFF → TR3／MCD a → TR2
    [[1280, P], [1280, 100]], [[1280, 140], [1280, 440]],
    [[1340, P], [1340, 100]], [[1340, 140], [1340, 210]], [[1340, 250], [1340, 440]],
    // G
    [[1420, P], [1420, 130]], [[1420, 170], [1420, 230]], [[1420, 270], [1420, 440]], [[1420, 480], [1420, N0]],
    // 線圈／燈下端 → 共同線
    [[900, 480], [900, N1]], [[960, 480], [960, N1]], [[1020, 480], [1020, N1]], [[1080, 480], [1080, N1]],
    [[1140, 480], [1140, N1]], [[1200, 480], [1200, N1]], [[1280, 480], [1280, N1]], [[1340, 480], [1340, N1]],
  ],
  main: Q2_1_SCHEMATIC.main,
};
