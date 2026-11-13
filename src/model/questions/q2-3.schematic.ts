/**
 * 第二站第三題 單線圖（依官方控制電路圖重繪，改用本模擬器的器具與端子名稱）。
 * 控制電路：每個符號的腳位綁實體端子，由 q2-3.test.ts 驗證與參考接線電氣一致。
 * 主電路：TB1 → NFB → MS1（MC1＋TH-RY1）→ TB2 → M1；MS2（MC2＋TH-RY2）→ TB5 → M2（直接起動）。
 */
import type { SchDiagram } from '../schematic';

const P = 70, N0 = 770;   // R 相／T 相母線
const MB = 350;           // 手動母線（COS/M 之後）

export const Q2_3_SCHEMATIC: SchDiagram = {
  w: 1460, h: 800,
  syms: [
    // 電源、保險絲
    { id: 'srcR', dev: 'NFB', kind: 'src', x: 400, y: P, t: ['NFB.A'], label: 'R' },
    { id: 'srcT', dev: 'NFB', kind: 'src', x: 400, y: N0, t: ['NFB.C'], label: 'T' },
    { id: 'df1', dev: 'DF1', kind: 'fuse', x: 450, y: P, t: ['DF1.上', 'DF1.下'], label: 'D-F' },
    { id: 'df2', dev: 'DF2', kind: 'fuse', x: 450, y: N0, t: ['DF2.上', 'DF2.下'], label: 'D-F' },
    // 61F-G：電源、輸出接點 Tc-Ta、電極端子；X／MR 線圈、G1 與 Ta 並聯
    { id: 'lcCoil', dev: 'LC', kind: 'coil', x: 480, y: 630, t: ['LC.S2', 'LC.S0'], label: '61F-G', note: 'S2-S0' },
    { id: 'lvA', dev: 'LC', kind: 'lv-no', x: 560, y: 130, t: ['LC.Tc', 'LC.Ta'], label: '61F-G', note: 'Tc-Ta' },
    { id: 'xCoil', dev: 'X', kind: 'coil', x: 560, y: 630, t: ['X.2', 'X.7'], note: '2-7' },
    { id: 'mrCoil', dev: 'MR', kind: 'coil', x: 620, y: 630, t: ['MR.2', 'MR.7'], note: '2-7' },
    { id: 'lampG1', dev: 'G1', kind: 'lamp', x: 680, y: 630, t: ['G1.X1', 'G1.X2'] },
    { id: 'lcE3', dev: 'LC', kind: 'term', x: 726, y: 470, t: ['LC.E3'], label: 'E3' },
    { id: 'lcE2', dev: 'LC', kind: 'term', x: 740, y: 450, t: ['LC.E2'], label: 'E2' },
    { id: 'lcE1', dev: 'LC', kind: 'term', x: 754, y: 430, t: ['LC.E1'], label: 'E1' },
    { id: 'gnd', dev: 'G_BAR', kind: 'term', x: 700, y: 470, t: ['G_BAR.G3'], label: 'G' },
    { id: 'elec', dev: 'ELEC', kind: 'electrode', x: 740, y: 560, t: ['ELEC.E3', 'ELEC.E2', 'ELEC.E1'], label: '電極棒' },
    // X b → FS → COS
    { id: 'xB', dev: 'X', kind: 'nc', x: 800, y: 130, t: ['X.1', 'X.3'], note: '1-3' },
    { id: 'fs', dev: 'FS', kind: 'fs', x: 800, y: 210, t: ['FS.a上', 'FS.a下'] },
    { id: 'cosM', dev: 'COS', kind: 'sw-nc', x: 770, y: 290, t: ['COS.M1', 'COS.M2'], note: 'M 手動', left: true },
    { id: 'cosA', dev: 'COS', kind: 'sw-no', x: 830, y: 290, t: ['COS.A1', 'COS.A2'], note: 'A 自動' },
    // 手動側：第 1 台
    { id: 'off1', dev: 'OFF1', kind: 'pb-nc', x: 900, y: 390, t: ['OFF1.b上', 'OFF1.b下'] },
    { id: 'mc1Hold', dev: 'MC1', kind: 'no', x: 840, y: 470, t: ['MC1.a左上', 'MC1.a左下'], note: 'a左', left: true },
    { id: 'on1', dev: 'ON1', kind: 'pb-no', x: 900, y: 470, t: ['ON1.a上', 'ON1.a下'] },
    { id: 'mc2Lock', dev: 'MC2', kind: 'nc', x: 900, y: 550, t: ['MC2.b左上', 'MC2.b左下'], note: 'b左' },
    { id: 'mc1Coil', dev: 'MC1', kind: 'coil', x: 900, y: 630, t: ['MC1.A1', 'MC1.A2'] },
    { id: 'lampR1', dev: 'R1', kind: 'lamp', x: 960, y: 630, t: ['R1.X1', 'R1.X2'] },
    { id: 'th1B', dev: 'THRY1', kind: 'trip-nc', x: 900, y: 710, t: ['THRY1.b', 'THRY1.c'], label: 'TH-RY1', note: '96-95' },
    // 棘輪電驛（自動側選台）
    { id: 'mr', dev: 'MR', kind: 'co', flip: true, x: 1000, y: 400, t: ['MR.1', 'MR.3', 'MR.4'], note: '1-3 / 1-4' },
    // 手動側：第 2 台
    { id: 'off2', dev: 'OFF2', kind: 'pb-nc', x: 1100, y: 390, t: ['OFF2.b上', 'OFF2.b下'] },
    { id: 'mc2Hold', dev: 'MC2', kind: 'no', x: 1040, y: 470, t: ['MC2.a左上', 'MC2.a左下'], note: 'a左', left: true },
    { id: 'on2', dev: 'ON2', kind: 'pb-no', x: 1100, y: 470, t: ['ON2.a上', 'ON2.a下'] },
    { id: 'mc1Lock', dev: 'MC1', kind: 'nc', x: 1100, y: 550, t: ['MC1.b左上', 'MC1.b左下'], note: 'b左' },
    { id: 'mc2Coil', dev: 'MC2', kind: 'coil', x: 1100, y: 630, t: ['MC2.A1', 'MC2.A2'] },
    { id: 'lampR2', dev: 'R2', kind: 'lamp', x: 1160, y: 630, t: ['R2.X1', 'R2.X2'] },
    { id: 'th2B', dev: 'THRY2', kind: 'trip-nc', x: 1100, y: 710, t: ['THRY2.b', 'THRY2.c'], label: 'TH-RY2', note: '96-95' },
    // 蜂鳴器：TH-RY a 接點並聯
    { id: 'bz', dev: 'BZ', kind: 'bz', x: 1240, y: 300, t: ['BZ.1', 'BZ.2'] },
    { id: 'th1A', dev: 'THRY1', kind: 'trip-no', x: 1240, y: 710, t: ['THRY1.a', 'THRY1.c'], label: 'TH-RY1', note: '98-95', left: true },
    { id: 'th2A', dev: 'THRY2', kind: 'trip-no', x: 1300, y: 710, t: ['THRY2.a', 'THRY2.c'], label: 'TH-RY2', note: '98-95' },
    // G2：兩台都停
    { id: 'mc1G', dev: 'MC1', kind: 'nc', x: 1380, y: 200, t: ['MC1.b右上', 'MC1.b右下'], note: 'b右' },
    { id: 'mc2G', dev: 'MC2', kind: 'nc', x: 1380, y: 300, t: ['MC2.b右上', 'MC2.b右下'], note: 'b右' },
    { id: 'lampG2', dev: 'G2', kind: 'lamp', x: 1380, y: 630, t: ['G2.X1', 'G2.X2'] },
  ],
  wires: [
    // 母線
    [[400, P], [430, P]], [[470, P], [1380, P]],
    [[400, N0], [430, N0]], [[470, N0], [1380, N0]],
    // 61F-G 電源
    [[480, P], [480, 610]], [[480, 650], [480, N0]],
    // Tc-Ta → Ta 節點 → X、MR、G1
    [[560, P], [560, 110]], [[560, 150], [560, 610]], [[560, 200], [680, 200]],
    [[620, 200], [620, 610]], [[680, 200], [680, 610]],
    [[560, 650], [560, N0]], [[620, 650], [620, N0]], [[680, 650], [680, N0]],
    // 電極 E3 E2 E1 → 電極棒；E3 接地
    [[726, 470], [726, 540]], [[740, 450], [740, 540]], [[754, 430], [754, 540]], [[700, 470], [726, 470]],
    // X b → FS → COS 共用點（M、A 兩個接點的上端跨接）
    [[800, P], [800, 110]], [[800, 150], [800, 190]], [[800, 230], [800, 250]], [[770, 250], [830, 250]], [[770, 250], [770, 270]], [[830, 250], [830, 270]],
    // COS M → 手動母線 → OFF1、OFF2
    [[770, 310], [770, MB], [1100, MB]], [[900, MB], [900, 370]], [[1100, MB], [1100, 370]],
    // COS A → MR c
    [[830, 310], [830, 330], [1000, 330], [1000, 380]],
    // 第 1 台：OFF1 → 自保／ON1 → N1 → MC2 b → 線圈／R1 → TH-RY1 b → T
    [[900, 410], [900, 450]], [[840, 430], [900, 430]], [[840, 430], [840, 450]],
    [[840, 490], [840, 510]], [[900, 490], [900, 510]], [[900, 510], [900, 530]], [[840, 510], [1014, 510]],
    [[1014, 420], [1014, 510]],
    [[900, 570], [900, 610]], [[900, 590], [960, 590]], [[960, 590], [960, 610]],
    [[900, 650], [900, 690]], [[960, 650], [960, 670]], [[900, 670], [960, 670]],
    [[900, 730], [900, N0]],
    // 第 2 台
    [[1100, 410], [1100, 450]], [[1040, 430], [1100, 430]], [[1040, 430], [1040, 450]],
    [[1040, 490], [1040, 510]], [[1100, 490], [1100, 530]], [[1040, 510], [1100, 510]],
    [[986, 420], [986, 530], [1040, 530], [1040, 510]],
    [[1100, 570], [1100, 610]], [[1100, 590], [1160, 590]], [[1160, 590], [1160, 610]],
    [[1100, 650], [1100, 690]], [[1160, 650], [1160, 670]], [[1100, 670], [1160, 670]],
    [[1100, 730], [1100, N0]],
    // BZ → TH-RY1 a ∥ TH-RY2 a → T
    [[1240, P], [1240, 280]], [[1240, 320], [1240, 690]], [[1240, 650], [1300, 650]], [[1300, 650], [1300, 690]],
    [[1240, 730], [1240, N0]], [[1300, 730], [1300, N0]],
    // G2
    [[1380, P], [1380, 180]], [[1380, 220], [1380, 280]], [[1380, 320], [1380, 610]], [[1380, 650], [1380, N0]],
  ],
  main: {
    // 主電路：TB1 R S T → NFB → MS1（MC1 主接點 → TH-RY1 加熱器）→ TB2 → M1；分路 → MS2 → TB5 → M2
    syms: [
      { id: 'tb1R', dev: 'TB1', kind: 'term', x: 70, y: 58, t: ['TB1.A'], label: 'R' },
      { id: 'tb1S', dev: 'TB1', kind: 'term', x: 130, y: 58, t: ['TB1.B'], label: 'S' },
      { id: 'tb1T', dev: 'TB1', kind: 'term', x: 190, y: 58, t: ['TB1.C'], label: 'T' },
      { id: 'nfb1', dev: 'NFB', kind: 'breaker', x: 70, y: 110, t: ['NFB.電源A', 'NFB.A'], label: '' },
      { id: 'nfb2', dev: 'NFB', kind: 'breaker', x: 130, y: 110, t: ['NFB.電源B', 'NFB.B'], label: '' },
      { id: 'nfb3', dev: 'NFB', kind: 'breaker', x: 190, y: 110, t: ['NFB.電源C', 'NFB.C'], label: 'NFB' },
      { id: 'mc1a', dev: 'MC1', kind: 'main-no', x: 70, y: 240, t: ['MC1.R', 'MC1.U'], label: '' },
      { id: 'mc1b', dev: 'MC1', kind: 'main-no', x: 130, y: 240, t: ['MC1.S', 'MC1.V'], label: '' },
      { id: 'mc1c', dev: 'MC1', kind: 'main-no', x: 190, y: 240, t: ['MC1.T', 'MC1.W'], label: 'MC1' },
      { id: 'mc2a', dev: 'MC2', kind: 'main-no', x: 250, y: 240, t: ['MC2.R', 'MC2.U'], label: '' },
      { id: 'mc2b', dev: 'MC2', kind: 'main-no', x: 290, y: 240, t: ['MC2.S', 'MC2.V'], label: '' },
      { id: 'mc2c', dev: 'MC2', kind: 'main-no', x: 330, y: 240, t: ['MC2.T', 'MC2.W'], label: 'MC2' },
      { id: 'th1a', dev: 'THRY1', kind: 'heater', x: 70, y: 330, t: ['THRY1.L1', 'THRY1.T1'], label: '' },
      { id: 'th1b', dev: 'THRY1', kind: 'heater', x: 130, y: 330, t: ['THRY1.L2', 'THRY1.T2'], label: '' },
      { id: 'th1c', dev: 'THRY1', kind: 'heater', x: 190, y: 330, t: ['THRY1.L3', 'THRY1.T3'], label: 'TH-RY1' },
      { id: 'th2a', dev: 'THRY2', kind: 'heater', x: 250, y: 330, t: ['THRY2.L1', 'THRY2.T1'], label: '' },
      { id: 'th2b', dev: 'THRY2', kind: 'heater', x: 290, y: 330, t: ['THRY2.L2', 'THRY2.T2'], label: '' },
      { id: 'th2c', dev: 'THRY2', kind: 'heater', x: 330, y: 330, t: ['THRY2.L3', 'THRY2.T3'], label: 'TH-RY2' },
      { id: 'tb2U', dev: 'TB2', kind: 'term', x: 70, y: 400, t: ['TB2.U'], label: 'U' },
      { id: 'tb2V', dev: 'TB2', kind: 'term', x: 130, y: 400, t: ['TB2.V'], label: 'V' },
      { id: 'tb2W', dev: 'TB2', kind: 'term', x: 190, y: 400, t: ['TB2.W'], label: 'W' },
      { id: 'tb5U', dev: 'TB5', kind: 'term', x: 250, y: 400, t: ['TB5.U'], label: 'U' },
      { id: 'tb5V', dev: 'TB5', kind: 'term', x: 290, y: 400, t: ['TB5.V'], label: 'V' },
      { id: 'tb5W', dev: 'TB5', kind: 'term', x: 330, y: 400, t: ['TB5.W'], label: 'W' },
      { id: 'm1', dev: 'TB2', kind: 'motor3', x: 130, y: 470, t: ['M1.U', 'M1.V', 'M1.W'], label: 'M1' },
      { id: 'm2', dev: 'TB5', kind: 'motor3', x: 290, y: 470, t: ['M2.U', 'M2.V', 'M2.W'], label: 'M2' },
    ],
    wires: [
      [[70, 58], [70, 90]], [[130, 58], [130, 90]], [[190, 58], [190, 90]],
      [[70, 130], [70, 220]], [[130, 130], [130, 220]], [[190, 130], [190, 220]],
      // MS2 由三相分出
      [[70, 160], [250, 160], [250, 220]], [[130, 172], [290, 172], [290, 220]], [[190, 184], [330, 184], [330, 220]],
      [[70, 260], [70, 310]], [[130, 260], [130, 310]], [[190, 260], [190, 310]],
      [[250, 260], [250, 310]], [[290, 260], [290, 310]], [[330, 260], [330, 310]],
      [[70, 350], [70, 400]], [[130, 350], [130, 400]], [[190, 350], [190, 400]],
      [[250, 350], [250, 400]], [[290, 350], [290, 400]], [[330, 350], [330, 400]],
      [[70, 400], [114, 454]], [[130, 400], [130, 448]], [[190, 400], [146, 454]],
      [[250, 400], [274, 454]], [[290, 400], [290, 448]], [[330, 400], [306, 454]],
    ],
    deco: `
<text x="200" y="28" class="sch-title">主電路（考場已配妥）</text>
<rect x="45" y="45" width="170" height="26" class="sch-box"/><text x="222" y="63" class="sch-lbl">TB1</text>
<path d="M80,110 H200" class="sch-link"/>
<rect x="45" y="388" width="170" height="24" class="sch-box"/><text x="130" y="384" class="sch-sm" text-anchor="middle">TB2</text>
<rect x="232" y="388" width="116" height="24" class="sch-box"/><text x="290" y="384" class="sch-sm" text-anchor="middle">TB5</text>
<text x="130" y="520" class="sch-sm" text-anchor="middle">5HP 抽水泵 M1</text>
<text x="290" y="520" class="sch-sm" text-anchor="middle">5HP 抽水泵 M2</text>
<path d="M108,470 H92 V486 M84,486 H100 M87,490 H97 M90,494 H94" class="sch-deco"/>
<path d="M268,470 H252 V486 M244,486 H260 M247,490 H257 M250,494 H254" class="sch-deco"/>
<text x="200" y="560" class="sch-sm" text-anchor="middle">MS1＝MC1＋TH-RY1、MS2＝MC2＋TH-RY2（電磁開關）</text>`,
  },
};
