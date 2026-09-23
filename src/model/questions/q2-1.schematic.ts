/**
 * 第二站第一題 單線圖（依官方控制電路圖重繪，改用本模擬器的器具與端子名稱）。
 * 右半控制電路：每個符號的腳位綁實體端子，由 schematic.test.ts 驗證與老師 18 步參考接線電氣一致。
 * 左半主電路：考場已配妥；以「各接觸器閉合時電動機各端帶哪一相」驗證（Y、Δ、正反轉、互鎖短路、TH-RY 加熱器串在迴路上）。
 */
import type { SchDiagram } from '../schematic';

const R = 70, T = 640;          // 控制電源兩條母線（R 相 / T 相）的 y
const BUS = 180, NODE = 280, COILS = 520;

export const Q2_1_SCHEMATIC: SchDiagram = {
  w: 1230, h: 690,
  syms: [
    // 電源與保險絲
    { id: 'srcR', dev: 'NFB', kind: 'src', x: 400, y: R, t: ['NFB.A'], label: 'R' },
    { id: 'srcT', dev: 'NFB', kind: 'src', x: 400, y: T, t: ['NFB.C'], label: 'T' },
    { id: 'df1', dev: 'DF1', kind: 'fuse', x: 450, y: R, t: ['DF1.上', 'DF1.下'], label: 'D-F' },
    { id: 'df2', dev: 'DF2', kind: 'fuse', x: 450, y: T, t: ['DF2.上', 'DF2.下'], label: 'D-F' },
    // 蜂鳴器與積熱電驛 1c 接點
    { id: 'bz', dev: 'BZ', kind: 'bz', x: 520, y: 380, t: ['BZ.1', 'BZ.2'] },
    { id: 'thry', dev: 'THRY', kind: 'co', x: 560, y: 590, t: ['THRY.c', 'THRY.b', 'THRY.a'], label: 'TH-RY', note: '95 / 96 / 98' },
    // OFF
    { id: 'off', dev: 'OFF', kind: 'pb-nc', x: 640, y: 130, t: ['OFF.b上', 'OFF.b下'] },
    // 正轉：FWD ∥ MCF 自保 → MCR b 互鎖 → MCF 線圈
    { id: 'fwd', dev: 'FWD', kind: 'pb-no', x: 640, y: 230, t: ['FWD.a上', 'FWD.a下'] },
    { id: 'mcfHold', dev: 'MCF', kind: 'no', x: 600, y: 230, t: ['MCF.a左上', 'MCF.a左下'], note: 'a左', left: true },
    { id: 'mcrLock', dev: 'MCR', kind: 'nc', x: 640, y: 330, t: ['MCR.b左上', 'MCR.b左下'], note: 'b左' },
    { id: 'mcfCoil', dev: 'MCF', kind: 'coil', x: 640, y: 460, t: ['MCF.A1', 'MCF.A2'] },
    // 反轉：REV ∥ MCR 自保 → MCF b 互鎖 → MCR 線圈
    { id: 'rev', dev: 'REV', kind: 'pb-no', x: 760, y: 230, t: ['REV.a上', 'REV.a下'] },
    { id: 'mcrHold', dev: 'MCR', kind: 'no', x: 720, y: 230, t: ['MCR.a左上', 'MCR.a左下'], note: 'a左', left: true },
    { id: 'mcfLock', dev: 'MCF', kind: 'nc', x: 760, y: 330, t: ['MCF.b左上', 'MCF.b左下'], note: 'b左' },
    { id: 'mcrCoil', dev: 'MCR', kind: 'coil', x: 760, y: 460, t: ['MCR.A1', 'MCR.A2'] },
    // Y-Δ：MCF a ∥ MCR a → TR 線圈 / TR 8-5 → MCD b → MCS(Y) / TR 8-6 → MCS b → MCD(R)
    { id: 'mcfRun', dev: 'MCF', kind: 'no', x: 900, y: 230, t: ['MCF.a右上', 'MCF.a右下'], note: 'a右' },
    { id: 'mcrRun', dev: 'MCR', kind: 'no', x: 1020, y: 230, t: ['MCR.a右上', 'MCR.a右下'], note: 'a右' },
    { id: 'trCoil', dev: 'TR', kind: 'coil', x: 840, y: 460, t: ['TR.2', 'TR.7'], note: '2-7' },
    { id: 'trY', dev: 'TR', kind: 'td-nc', x: 900, y: 320, t: ['TR.8', 'TR.5'], note: '8-5' },
    { id: 'mcdLock', dev: 'MCD', kind: 'nc', x: 900, y: 380, t: ['MCD.b左上', 'MCD.b左下'], note: 'b左' },
    { id: 'mcsCoil', dev: 'MCS', kind: 'coil', x: 900, y: 460, t: ['MCS.A1', 'MCS.A2'] },
    { id: 'lampY', dev: 'Y', kind: 'lamp', x: 960, y: 460, t: ['Y.X1', 'Y.X2'] },
    { id: 'trD', dev: 'TR', kind: 'td-no', x: 1020, y: 320, t: ['TR.8', 'TR.6'], note: '8-6' },
    { id: 'mcsLock', dev: 'MCS', kind: 'nc', x: 1020, y: 380, t: ['MCS.b左上', 'MCS.b左下'], note: 'b左' },
    { id: 'mcdCoil', dev: 'MCD', kind: 'coil', x: 1020, y: 460, t: ['MCD.A1', 'MCD.A2'] },
    { id: 'lampR', dev: 'R', kind: 'lamp', x: 1080, y: 460, t: ['R.X1', 'R.X2'] },
    // 停止指示：MCF b → MCR b → G
    { id: 'mcfG', dev: 'MCF', kind: 'nc', x: 1160, y: 200, t: ['MCF.b右上', 'MCF.b右下'], note: 'b右' },
    { id: 'mcrG', dev: 'MCR', kind: 'nc', x: 1160, y: 280, t: ['MCR.b右上', 'MCR.b右下'], note: 'b右' },
    { id: 'lampG', dev: 'G', kind: 'lamp', x: 1160, y: 460, t: ['G.X1', 'G.X2'] },
  ],
  wires: [
    // 母線
    [[400, R], [430, R]], [[470, R], [1160, R]],
    [[400, T], [430, T]], [[470, T], [1160, T]],
    // BZ：R 母線 → BZ → TH-RY a
    [[520, R], [520, 360]], [[520, 400], [520, 545], [546, 545], [546, 570]],
    // TH-RY：c → T 母線、b → 線圈共同線
    [[560, 610], [560, T]], [[574, 570], [574, COILS]],
    // OFF
    [[640, R], [640, 110]], [[640, 150], [640, BUS]],
    // OFF 之後的共同線
    [[600, BUS], [1020, BUS]],
    // 正轉
    [[600, BUS], [600, 210]], [[640, BUS], [640, 210]],
    [[600, 250], [600, 280], [640, 280]], [[640, 250], [640, 310]],
    [[640, 350], [640, 440]],
    // 反轉
    [[720, BUS], [720, 210]], [[760, BUS], [760, 210]],
    [[720, 250], [720, 280], [760, 280]], [[760, 250], [760, 310]],
    [[760, 350], [760, 440]],
    // Y-Δ
    [[900, BUS], [900, 210]], [[1020, BUS], [1020, 210]],
    [[840, NODE], [1020, NODE]], [[900, 250], [900, NODE]], [[1020, 250], [1020, NODE]],
    [[840, NODE], [840, 440]],
    [[900, NODE], [900, 300]], [[900, 340], [900, 360]], [[900, 400], [900, 440]], [[900, 420], [960, 420], [960, 440]],
    [[1020, NODE], [1020, 300]], [[1020, 340], [1020, 360]], [[1020, 400], [1020, 440]], [[1020, 420], [1080, 420], [1080, 440]],
    // 線圈／燈 下端 → 共同線
    [[574, COILS], [1080, COILS]],
    [[640, 480], [640, COILS]], [[760, 480], [760, COILS]], [[840, 480], [840, COILS]], [[900, 480], [900, COILS]],
    [[960, 480], [960, COILS]], [[1020, 480], [1020, COILS]], [[1080, 480], [1080, COILS]],
    // G
    [[1160, R], [1160, 180]], [[1160, 220], [1160, 260]], [[1160, 300], [1160, 440]], [[1160, 480], [1160, T]],
  ],
  main: {
    // 主電路：TB1 R S T → NFB → MCF（正相）／MCR（R、T 對調）→ TH-RY 加熱器 → TB2 U V W → 電動機 → TB2 X Y Z；
    // MCD 由接觸器後的三相接到 Z X Y（Δ），MCS 把 X Y Z 短接（Y）。由 schematic.test.ts 以「通電後各端帶哪一相」驗證。
    syms: [
      { id: 'tb1R', dev: 'TB1', kind: 'term', x: 70, y: 58, t: ['TB1.A'], label: 'R' },
      { id: 'tb1S', dev: 'TB1', kind: 'term', x: 130, y: 58, t: ['TB1.B'], label: 'S' },
      { id: 'tb1T', dev: 'TB1', kind: 'term', x: 190, y: 58, t: ['TB1.C'], label: 'T' },
      { id: 'nfb1', dev: 'NFB', kind: 'breaker', x: 70, y: 110, t: ['NFB.電源A', 'NFB.A'], label: '' },
      { id: 'nfb2', dev: 'NFB', kind: 'breaker', x: 130, y: 110, t: ['NFB.電源B', 'NFB.B'], label: '' },
      { id: 'nfb3', dev: 'NFB', kind: 'breaker', x: 190, y: 110, t: ['NFB.電源C', 'NFB.C'], label: 'NFB' },
      { id: 'mcf1', dev: 'MCF', kind: 'main-no', x: 70, y: 240, t: ['MCF.R', 'MCF.U'], label: '' },
      { id: 'mcf2', dev: 'MCF', kind: 'main-no', x: 130, y: 240, t: ['MCF.S', 'MCF.V'], label: '' },
      { id: 'mcf3', dev: 'MCF', kind: 'main-no', x: 190, y: 240, t: ['MCF.T', 'MCF.W'], label: 'MCF' },
      { id: 'mcr1', dev: 'MCR', kind: 'main-no', x: 250, y: 240, t: ['MCR.R', 'MCR.U'], label: '' },
      { id: 'mcr2', dev: 'MCR', kind: 'main-no', x: 290, y: 240, t: ['MCR.S', 'MCR.V'], label: '' },
      { id: 'mcr3', dev: 'MCR', kind: 'main-no', x: 330, y: 240, t: ['MCR.T', 'MCR.W'], label: 'MCR' },
      { id: 'th1', dev: 'THRY', kind: 'heater', x: 70, y: 400, t: ['THRY.L1', 'THRY.T1'], label: '' },
      { id: 'th2', dev: 'THRY', kind: 'heater', x: 130, y: 400, t: ['THRY.L2', 'THRY.T2'], label: '' },
      { id: 'th3', dev: 'THRY', kind: 'heater', x: 190, y: 400, t: ['THRY.L3', 'THRY.T3'], label: 'TH-RY' },
      { id: 'tb2U', dev: 'TB2', kind: 'term', x: 70, y: 444, t: ['TB2.U'], label: 'U' },
      { id: 'tb2V', dev: 'TB2', kind: 'term', x: 130, y: 444, t: ['TB2.V'], label: 'V' },
      { id: 'tb2W', dev: 'TB2', kind: 'term', x: 190, y: 444, t: ['TB2.W'], label: 'W' },
      { id: 'motor', dev: 'TB2', kind: 'motor', x: 130, y: 500, t: ['M.U', 'M.V', 'M.W', 'M.X', 'M.Y', 'M.Z'], label: 'M' },
      { id: 'tb2X', dev: 'TB2', kind: 'term', x: 70, y: 560, t: ['TB2.X'], label: 'X' },
      { id: 'tb2Y', dev: 'TB2', kind: 'term', x: 130, y: 560, t: ['TB2.Y'], label: 'Y' },
      { id: 'tb2Z', dev: 'TB2', kind: 'term', x: 190, y: 560, t: ['TB2.Z'], label: 'Z' },
      { id: 'mcd1', dev: 'MCD', kind: 'main-no', x: 250, y: 520, t: ['MCD.R', 'MCD.U'], label: '' },
      { id: 'mcd2', dev: 'MCD', kind: 'main-no', x: 290, y: 520, t: ['MCD.S', 'MCD.V'], label: '' },
      { id: 'mcd3', dev: 'MCD', kind: 'main-no', x: 330, y: 520, t: ['MCD.T', 'MCD.W'], label: 'MCD' },
      { id: 'mcs1', dev: 'MCS', kind: 'main-no', x: 70, y: 640, t: ['MCS.R', 'MCS.U'], label: '' },
      { id: 'mcs2', dev: 'MCS', kind: 'main-no', x: 130, y: 640, t: ['MCS.S', 'MCS.V'], label: '' },
      { id: 'mcs3', dev: 'MCS', kind: 'main-no', x: 190, y: 640, t: ['MCS.T', 'MCS.W'], label: 'MCS' },
    ],
    wires: [
      [[70, 58], [70, 90]], [[130, 58], [130, 90]], [[190, 58], [190, 90]],
      [[70, 130], [70, 220]], [[130, 130], [130, 220]], [[190, 130], [190, 220]],
      // MCR 由三相分出
      [[70, 160], [250, 160], [250, 220]], [[130, 172], [290, 172], [290, 220]], [[190, 184], [330, 184], [330, 220]],
      [[70, 260], [70, 380]], [[130, 260], [130, 380]], [[190, 260], [190, 380]],
      // MCR 出線：R、T 對調後併回
      [[250, 260], [250, 280], [190, 280]], [[290, 260], [290, 296], [130, 296]], [[330, 260], [330, 312], [70, 312]],
      // MCD 由接觸器後的三相分出
      [[250, 280], [250, 500]], [[290, 296], [290, 500]], [[330, 312], [330, 500]],
      [[70, 420], [70, 444]], [[130, 420], [130, 444]], [[190, 420], [190, 444]],
      [[70, 444], [114, 484]], [[130, 444], [130, 478]], [[190, 444], [146, 484]],
      [[114, 516], [70, 560]], [[130, 522], [130, 560]], [[146, 516], [190, 560]],
      [[70, 560], [70, 620]], [[130, 560], [130, 620]], [[190, 560], [190, 620]],
      // MCS 短接成 Y
      [[70, 660], [70, 672], [190, 672], [190, 660]], [[130, 660], [130, 672]],
      // MCD 出線 → Z、X、Y（Δ）
      [[250, 540], [250, 588], [130, 588]], [[290, 540], [290, 612], [70, 612]], [[330, 540], [330, 600], [190, 600]],
    ],
    deco: `
<text x="130" y="28" class="sch-title">主電路（考場已配妥）</text>
<rect x="45" y="45" width="170" height="26" class="sch-box"/><text x="222" y="63" class="sch-lbl">TB1</text>
<path d="M80,110 H200" class="sch-link"/>
<rect x="45" y="432" width="170" height="24" class="sch-box"/><text x="222" y="449" class="sch-lbl">TB2</text>
<rect x="45" y="548" width="170" height="24" class="sch-box"/><text x="222" y="565" class="sch-lbl">TB2</text>
<text x="160" y="506" class="sch-sm">3φ 電動機</text>
<path d="M108,500 H86 V516 M78,516 H94 M81,520 H91 M84,524 H88" class="sch-deco"/>
<text x="235" y="682" class="sch-sm">MCS 閉合 → Y　MCD 閉合 → Δ</text>`,
  },
};
