/**
 * 第二站第四題 單線圖（依官方控制電路圖重繪，改用本模擬器的器具與端子名稱）。
 * 控制電路：每個符號的腳位綁實體端子，由 q2-4.test.ts 驗證與參考接線電氣一致。
 * 主電路：電源 → NFB3 → TB1 → NFB1 → MC1 → TH-RY1 → TB2 → M1；NFB2 → MC2 → TH-RY2 → TB6 → M2（直接起動）。
 */
import type { SchDiagram } from '../schematic';

const P = 70, N0 = 770;      // R 相／T 相母線
const MB = 190;              // 手動母線（COS/M 之後）
const AO = 165;              // 自動母線（COS/A 之後 → S2、Tc1）
const N1 = 405, N2 = 380;    // MC1／MC2 的線圈節點（往右拉到 61F-APN2 第二組接點）
const BZL = 660;             // BZ → TH-RY a 接點

export const Q2_4_SCHEMATIC: SchDiagram = {
  w: 1540, h: 800,
  syms: [
    // 電源、保險絲
    { id: 'srcR', dev: 'NFB', kind: 'src', x: 400, y: P, t: ['NFB.A'], label: 'R' },
    { id: 'srcT', dev: 'NFB', kind: 'src', x: 400, y: N0, t: ['NFB.C'], label: 'T' },
    { id: 'df1', dev: 'DF1', kind: 'fuse', x: 450, y: P, t: ['DF1.上', 'DF1.下'], label: 'D-F' },
    { id: 'df2', dev: 'DF2', kind: 'fuse', x: 450, y: N0, t: ['DF2.上', 'DF2.下'], label: 'D-F' },
    // 蜂鳴器
    { id: 'bz', dev: 'BZ', kind: 'bz', x: 520, y: 300, t: ['BZ.1', 'BZ.2'] },
    // X a 接點 → 61F-APN2 第一組（異常水位時補上另一台）
    { id: 'xA', dev: 'X', kind: 'no', x: 600, y: 130, t: ['X.1', 'X.4'], note: '1-4' },
    { id: 'apn1', dev: 'APN', kind: 'co', flip: true, x: 600, y: 230, t: ['APN.1', 'APN.3', 'APN.4'], label: 'APN2', note: '1-3 / 1-4' },
    // 浮球開關與電極端子（E3 接地）
    { id: 'gnd', dev: 'G_BAR', kind: 'term', x: 556, y: 480, t: ['G_BAR.G3'], label: 'G' },
    { id: 'lcE3', dev: 'LC', kind: 'term', x: 580, y: 480, t: ['LC.E3'], label: 'E3' },
    { id: 'lcE1', dev: 'LC', kind: 'term', x: 620, y: 480, t: ['LC.E1'], label: 'E1' },
    { id: 'lcE4', dev: 'LC', kind: 'term', x: 660, y: 480, t: ['LC.E4'], label: 'E4' },
    { id: 'bs1', dev: 'BS1', kind: 'fs', x: 620, y: 540, t: ['BS1.2', 'BS1.1'], left: true },
    { id: 'bs2', dev: 'BS2', kind: 'fs', x: 660, y: 540, t: ['BS2.2', 'BS2.1'] },
    // COS：M 接點 → 手動母線
    { id: 'cosM', dev: 'COS', kind: 'sw-nc', x: 800, y: 130, t: ['COS.M1', 'COS.M2'], note: 'M 手動' },
    // 手動側：第 1 台
    { id: 'off1', dev: 'OFF1', kind: 'pb-nc', x: 760, y: 230, t: ['OFF1.b上', 'OFF1.b下'] },
    { id: 'mc1Hold', dev: 'MC1', kind: 'no', x: 700, y: 330, t: ['MC1.a左上', 'MC1.a左下'], note: 'a左', left: true },
    { id: 'on1', dev: 'ON1', kind: 'pb-no', x: 760, y: 330, t: ['ON1.a上', 'ON1.a下'] },
    { id: 'lampR1', dev: 'R1', kind: 'lamp', x: 700, y: 450, t: ['R1.X1', 'R1.X2'] },
    { id: 'mc1Coil', dev: 'MC1', kind: 'coil', x: 760, y: 450, t: ['MC1.A1', 'MC1.A2'] },
    { id: 'th1', dev: 'THRY1', kind: 'co', x: 760, y: 710, t: ['THRY1.c', 'THRY1.b', 'THRY1.a'], label: 'TH-RY1', note: '95 / 96 / 98' },
    // 手動側：第 2 台
    { id: 'off2', dev: 'OFF2', kind: 'pb-nc', x: 960, y: 230, t: ['OFF2.b上', 'OFF2.b下'] },
    { id: 'mc2Hold', dev: 'MC2', kind: 'no', x: 900, y: 330, t: ['MC2.a左上', 'MC2.a左下'], note: 'a左', left: true },
    { id: 'on2', dev: 'ON2', kind: 'pb-no', x: 960, y: 330, t: ['ON2.a上', 'ON2.a下'] },
    { id: 'lampR2', dev: 'R2', kind: 'lamp', x: 900, y: 450, t: ['R2.X1', 'R2.X2'] },
    { id: 'mc2Coil', dev: 'MC2', kind: 'coil', x: 960, y: 450, t: ['MC2.A1', 'MC2.A2'] },
    { id: 'th2', dev: 'THRY2', kind: 'co', x: 960, y: 710, t: ['THRY2.c', 'THRY2.b', 'THRY2.a'], label: 'TH-RY2', note: '95 / 96 / 98' },
    // COS：A 接點 → 61F-G2 電源與 Tc1
    { id: 'cosA', dev: 'COS', kind: 'sw-no', x: 1040, y: 130, t: ['COS.A1', 'COS.A2'], note: 'A 自動' },
    // 61F-APN2 第二組（平常運轉用）、61F-G2 的 U1（1c）與 U2
    { id: 'apn2', dev: 'APN', kind: 'co', flip: true, x: 1086, y: 300, t: ['APN.8', 'APN.6', 'APN.5'], label: '', note: '8-6 / 8-5' },
    { id: 'u1', dev: 'LC', kind: 'co', flip: true, x: 1140, y: 200, t: ['LC.Tc1', 'LC.Tb1', 'LC.Ta1'], label: 'U1', note: '61F-G2' },
    { id: 'u2', dev: 'LC', kind: 'lv-no', x: 1230, y: 300, t: ['LC.Tc2', 'LC.Ta2'], label: 'U2', note: 'Tc2-Ta2' },
    { id: 'apnCoil', dev: 'APN', kind: 'coil', x: 1154, y: 450, t: ['APN.2', 'APN.7'], label: 'APN2', note: '2-7' },
    { id: 'xCoil', dev: 'X', kind: 'coil', x: 1230, y: 450, t: ['X.2', 'X.7'], note: '2-7' },
    { id: 'lampY', dev: 'Y', kind: 'lamp', x: 1290, y: 450, t: ['Y.X1', 'Y.X2'] },
    { id: 'lcCoil', dev: 'LC', kind: 'coil', x: 1350, y: 450, t: ['LC.S2', 'LC.S0'], label: '61F', note: 'S2-S0' },
    // G1／G2：各自 MC 的 b 接點
    { id: 'mc1G', dev: 'MC1', kind: 'nc', x: 1410, y: 200, t: ['MC1.b右上', 'MC1.b右下'], note: 'b右' },
    { id: 'lampG1', dev: 'G1', kind: 'lamp', x: 1410, y: 450, t: ['G1.X1', 'G1.X2'] },
    { id: 'mc2G', dev: 'MC2', kind: 'nc', x: 1470, y: 200, t: ['MC2.b右上', 'MC2.b右下'], note: 'b右' },
    { id: 'lampG2', dev: 'G2', kind: 'lamp', x: 1470, y: 450, t: ['G2.X1', 'G2.X2'] },
  ],
  wires: [
    // 母線
    [[400, P], [430, P]], [[470, P], [1470, P]],
    [[400, N0], [430, N0]], [[470, N0], [1470, N0]],
    // BZ → TH-RY1 a ∥ TH-RY2 a
    [[520, P], [520, 280]], [[520, 320], [520, BZL], [946, BZL], [946, 690]], [[746, BZL], [746, 690]],
    // X a → APN 第一組共用
    [[600, P], [600, 110]], [[600, 150], [600, 210]],
    // MC1 節點（APN 1-4、8-6）與 MC2 節點（APN 1-3、8-5）
    [[586, 250], [586, N1], [1100, N1], [1100, 320]],
    [[614, 250], [614, N2], [1072, N2], [1072, 320]],
    // 浮球：E3 共用（接地）、BS1 → E1、BS2 → E4
    [[556, 480], [580, 480]], [[580, 480], [580, 590], [660, 590]],
    [[620, 480], [620, 520]], [[620, 560], [620, 590]], [[660, 480], [660, 520]], [[660, 560], [660, 590]],
    // COS M → 手動母線 → OFF1、OFF2
    [[800, P], [800, 110]], [[800, 150], [800, MB]], [[760, MB], [960, MB]], [[760, MB], [760, 210]], [[960, MB], [960, 210]],
    // 第 1 台：OFF1 → 自保／ON1 → MC1 節點 → R1／線圈 → TH-RY1 b → T
    [[760, 250], [760, 310]], [[700, 290], [760, 290]], [[700, 290], [700, 310]],
    [[700, 350], [700, N1]], [[700, N1], [700, 430]], [[760, 350], [760, N1]], [[760, N1], [760, 430]],
    [[700, 470], [700, 500], [774, 500], [774, 690]], [[760, 470], [760, 500]], [[760, 730], [760, N0]],
    // 第 2 台
    [[960, 250], [960, 310]], [[900, 290], [960, 290]], [[900, 290], [900, 310]],
    [[900, 350], [900, N2]], [[900, N2], [900, 430]], [[960, 350], [960, N2]], [[960, N2], [960, 430]],
    [[900, 470], [900, 500], [974, 500], [974, 690]], [[960, 470], [960, 500]], [[960, 730], [960, N0]],
    // COS A → 自動母線 → 61F-G2 電源 S2、Tc1
    [[1040, P], [1040, 110]], [[1040, 150], [1040, AO], [1350, AO], [1350, 430]], [[1140, AO], [1140, 180]],
    // Ta1 → Tc2、APN 第二組共用
    [[1086, 280], [1086, 250], [1230, 250], [1230, 280]], [[1126, 220], [1126, 250]],
    // Tb1 → APN 線圈
    [[1154, 220], [1154, 430]], [[1154, 470], [1154, N0]],
    // Ta2 → X 線圈、Y
    [[1230, 320], [1230, 430]], [[1230, 400], [1290, 400], [1290, 430]], [[1230, 470], [1230, N0]], [[1290, 470], [1290, N0]],
    [[1350, 470], [1350, N0]],
    // G1、G2
    [[1410, P], [1410, 180]], [[1410, 220], [1410, 430]], [[1410, 470], [1410, N0]],
    [[1470, P], [1470, 180]], [[1470, 220], [1470, 430]], [[1470, 470], [1470, N0]],
  ],
  main: {
    syms: [
      { id: 'nfb3a', dev: 'NFB', kind: 'breaker', x: 70, y: 90, t: ['NFB.電源A', 'NFB.A'], label: '' },
      { id: 'nfb3b', dev: 'NFB', kind: 'breaker', x: 130, y: 90, t: ['NFB.電源B', 'NFB.B'], label: '' },
      { id: 'nfb3c', dev: 'NFB', kind: 'breaker', x: 190, y: 90, t: ['NFB.電源C', 'NFB.C'], label: 'NFB3' },
      { id: 'tb1R', dev: 'TB1', kind: 'term', x: 70, y: 140, t: ['TB1.A'], label: 'R' },
      { id: 'tb1S', dev: 'TB1', kind: 'term', x: 130, y: 140, t: ['TB1.B'], label: 'S' },
      { id: 'tb1T', dev: 'TB1', kind: 'term', x: 190, y: 140, t: ['TB1.C'], label: 'T' },
      { id: 'nfb1a', dev: 'NFB1', kind: 'breaker', x: 70, y: 230, t: ['NFB1.電源A', 'NFB1.A'], label: '' },
      { id: 'nfb1b', dev: 'NFB1', kind: 'breaker', x: 130, y: 230, t: ['NFB1.電源B', 'NFB1.B'], label: '' },
      { id: 'nfb1c', dev: 'NFB1', kind: 'breaker', x: 190, y: 230, t: ['NFB1.電源C', 'NFB1.C'], label: 'NFB1' },
      { id: 'nfb2a', dev: 'NFB2', kind: 'breaker', x: 250, y: 230, t: ['NFB2.電源A', 'NFB2.A'], label: '' },
      { id: 'nfb2b', dev: 'NFB2', kind: 'breaker', x: 290, y: 230, t: ['NFB2.電源B', 'NFB2.B'], label: '' },
      { id: 'nfb2c', dev: 'NFB2', kind: 'breaker', x: 330, y: 230, t: ['NFB2.電源C', 'NFB2.C'], label: 'NFB2' },
      { id: 'mc1a', dev: 'MC1', kind: 'main-no', x: 70, y: 310, t: ['MC1.R', 'MC1.U'], label: '' },
      { id: 'mc1b', dev: 'MC1', kind: 'main-no', x: 130, y: 310, t: ['MC1.S', 'MC1.V'], label: '' },
      { id: 'mc1c', dev: 'MC1', kind: 'main-no', x: 190, y: 310, t: ['MC1.T', 'MC1.W'], label: 'MC1' },
      { id: 'mc2a', dev: 'MC2', kind: 'main-no', x: 250, y: 310, t: ['MC2.R', 'MC2.U'], label: '' },
      { id: 'mc2b', dev: 'MC2', kind: 'main-no', x: 290, y: 310, t: ['MC2.S', 'MC2.V'], label: '' },
      { id: 'mc2c', dev: 'MC2', kind: 'main-no', x: 330, y: 310, t: ['MC2.T', 'MC2.W'], label: 'MC2' },
      { id: 'th1a', dev: 'THRY1', kind: 'heater', x: 70, y: 390, t: ['THRY1.L1', 'THRY1.T1'], label: '' },
      { id: 'th1b', dev: 'THRY1', kind: 'heater', x: 130, y: 390, t: ['THRY1.L2', 'THRY1.T2'], label: '' },
      { id: 'th1c', dev: 'THRY1', kind: 'heater', x: 190, y: 390, t: ['THRY1.L3', 'THRY1.T3'], label: 'TH-RY1' },
      { id: 'th2a', dev: 'THRY2', kind: 'heater', x: 250, y: 390, t: ['THRY2.L1', 'THRY2.T1'], label: '' },
      { id: 'th2b', dev: 'THRY2', kind: 'heater', x: 290, y: 390, t: ['THRY2.L2', 'THRY2.T2'], label: '' },
      { id: 'th2c', dev: 'THRY2', kind: 'heater', x: 330, y: 390, t: ['THRY2.L3', 'THRY2.T3'], label: 'TH-RY2' },
      { id: 'tb2U', dev: 'TB2', kind: 'term', x: 70, y: 460, t: ['TB2.U'], label: 'U' },
      { id: 'tb2V', dev: 'TB2', kind: 'term', x: 130, y: 460, t: ['TB2.V'], label: 'V' },
      { id: 'tb2W', dev: 'TB2', kind: 'term', x: 190, y: 460, t: ['TB2.W'], label: 'W' },
      { id: 'tb6U', dev: 'TB6', kind: 'term', x: 250, y: 460, t: ['TB6.U'], label: 'U' },
      { id: 'tb6V', dev: 'TB6', kind: 'term', x: 290, y: 460, t: ['TB6.V'], label: 'V' },
      { id: 'tb6W', dev: 'TB6', kind: 'term', x: 330, y: 460, t: ['TB6.W'], label: 'W' },
      { id: 'm1', dev: 'TB2', kind: 'motor3', x: 130, y: 530, t: ['M1.U', 'M1.V', 'M1.W'], label: 'M1' },
      { id: 'm2', dev: 'TB6', kind: 'motor3', x: 290, y: 530, t: ['M2.U', 'M2.V', 'M2.W'], label: 'M2' },
    ],
    wires: [
      // NFB3 → TB1（電源引入線畫在 deco）
      [[70, 110], [70, 140]], [[130, 110], [130, 140]], [[190, 110], [190, 140]],
      // TB1 → NFB1；分到 NFB2
      [[70, 140], [70, 210]], [[130, 140], [130, 210]], [[190, 140], [190, 210]],
      [[70, 160], [250, 160], [250, 210]], [[130, 172], [290, 172], [290, 210]], [[190, 184], [330, 184], [330, 210]],
      [[70, 250], [70, 290]], [[130, 250], [130, 290]], [[190, 250], [190, 290]],
      [[250, 250], [250, 290]], [[290, 250], [290, 290]], [[330, 250], [330, 290]],
      [[70, 330], [70, 370]], [[130, 330], [130, 370]], [[190, 330], [190, 370]],
      [[250, 330], [250, 370]], [[290, 330], [290, 370]], [[330, 330], [330, 370]],
      [[70, 410], [70, 460]], [[130, 410], [130, 460]], [[190, 410], [190, 460]],
      [[250, 410], [250, 460]], [[290, 410], [290, 460]], [[330, 410], [330, 460]],
      [[70, 460], [114, 514]], [[130, 460], [130, 508]], [[190, 460], [146, 514]],
      [[250, 460], [274, 514]], [[290, 460], [290, 508]], [[330, 460], [306, 514]],
    ],
    deco: `
<text x="200" y="24" class="sch-title">主電路（考場已配妥）</text>
<text x="130" y="40" class="sch-sm" text-anchor="middle">3φ 3W 220V</text>
<path d="M70,46 V70 M130,46 V70 M190,46 V70" class="sch-deco"/>
<path d="M80,90 H200" class="sch-link"/><path d="M80,230 H200" class="sch-link"/><path d="M260,230 H340" class="sch-link"/>
<rect x="45" y="128" width="170" height="24" class="sch-box"/><text x="222" y="145" class="sch-lbl">TB1</text>
<rect x="45" y="448" width="170" height="24" class="sch-box"/><text x="130" y="444" class="sch-sm" text-anchor="middle">TB2</text>
<rect x="232" y="448" width="116" height="24" class="sch-box"/><text x="290" y="444" class="sch-sm" text-anchor="middle">TB6</text>
<text x="130" y="580" class="sch-sm" text-anchor="middle">5HP 污排水泵 M1</text>
<text x="290" y="580" class="sch-sm" text-anchor="middle">5HP 污排水泵 M2</text>
<path d="M108,530 H92 V546 M84,546 H100 M87,550 H97 M90,554 H94" class="sch-deco"/>
<path d="M268,530 H252 V546 M244,546 H260 M247,550 H257 M250,554 H254" class="sch-deco"/>
<text x="200" y="620" class="sch-sm" text-anchor="middle">控制電源取自 NFB3 負載側（R、T）</text>`,
  },
};
