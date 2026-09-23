/**
 * 第二站第一題 單線圖（依官方控制電路圖重繪，改用本模擬器的器具與端子名稱）。
 * 右半控制電路：每個符號的腳位綁實體端子，由 schematic.test.ts 驗證與老師 18 步參考接線電氣一致。
 * 左半主電路：考場已配妥，僅供參考（不參與驗證）。
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
    // 主電路：TB1 R S T → NFB → MCF（正相）／MCR（R、T 對調）→ TH-RY → TB2 U V W → 電動機 → TB2 X Y Z；MCD 接 Δ、MCS 短接成 Y
    svg: `
<text x="130" y="28" class="sch-title">主電路（已配妥・參考）</text>
<rect x="45" y="45" width="170" height="26" class="sch-box"/>
<circle cx="70" cy="58" r="3" class="sch-open"/><circle cx="130" cy="58" r="3" class="sch-open"/><circle cx="190" cy="58" r="3" class="sch-open"/>
<text x="78" y="63" class="sch-ph R">R</text><text x="138" y="63" class="sch-ph S">S</text><text x="198" y="63" class="sch-ph T">T</text>
<text x="222" y="63" class="sch-lbl">TB1</text>
<path d="M70,61 V93 M130,61 V93 M190,61 V93" class="sch-main"/>
<circle cx="70" cy="95" r="2.5" class="sch-open"/><circle cx="130" cy="95" r="2.5" class="sch-open"/><circle cx="190" cy="95" r="2.5" class="sch-open"/>
<path d="M70,97 C84,103 84,117 70,123 M130,97 C144,103 144,117 130,123 M190,97 C204,103 204,117 190,123" class="sch-main"/>
<path d="M80,110 H200" class="sch-link"/>
<circle cx="70" cy="125" r="2.5" class="sch-open"/><circle cx="130" cy="125" r="2.5" class="sch-open"/><circle cx="190" cy="125" r="2.5" class="sch-open"/>
<text x="222" y="114" class="sch-lbl">NFB</text>
<path d="M70,128 V234 M130,128 V234 M190,128 V234" class="sch-main"/>
<path d="M70,160 H250 V234 M130,172 H290 V234 M190,184 H330 V234" class="sch-main"/>
<circle cx="70" cy="160" r="3" class="sch-dot"/><circle cx="130" cy="172" r="3" class="sch-dot"/><circle cx="190" cy="184" r="3" class="sch-dot"/>
<path d="M60,234 H80 M60,246 H80 M120,234 H140 M120,246 H140 M180,234 H200 M180,246 H200" class="sch-plate"/>
<path d="M240,234 H260 M240,246 H260 M280,234 H300 M280,246 H300 M320,234 H340 M320,246 H340" class="sch-plate"/>
<text x="205" y="244" class="sch-lbl">MCF</text><text x="345" y="226" class="sch-lbl">MCR</text>
<path d="M70,246 V386 M130,246 V386 M190,246 V386" class="sch-main"/>
<path d="M250,246 V280 H190 M290,246 V296 H130 M330,246 V312 H70" class="sch-main"/>
<circle cx="190" cy="280" r="3" class="sch-dot"/><circle cx="130" cy="296" r="3" class="sch-dot"/><circle cx="70" cy="312" r="3" class="sch-dot"/>
<path d="M250,280 V514 M290,296 V514 M330,312 V514" class="sch-main"/>
<circle cx="250" cy="280" r="3" class="sch-dot"/><circle cx="290" cy="296" r="3" class="sch-dot"/><circle cx="330" cy="312" r="3" class="sch-dot"/>
<path d="M70,386 V394 H78 V406 H70 V414 M130,386 V394 H138 V406 H130 V414 M190,386 V394 H198 V406 H190 V414" class="sch-main"/>
<text x="210" y="404" class="sch-lbl">TH-RY</text>
<path d="M70,414 V441 M130,414 V441 M190,414 V441" class="sch-main"/>
<rect x="45" y="432" width="170" height="24" class="sch-box"/>
<circle cx="70" cy="444" r="3" class="sch-open"/><circle cx="130" cy="444" r="3" class="sch-open"/><circle cx="190" cy="444" r="3" class="sch-open"/>
<text x="76" y="441" class="sch-sm">U</text><text x="136" y="441" class="sch-sm">V</text><text x="196" y="441" class="sch-sm">W</text>
<text x="222" y="449" class="sch-lbl">TB2</text>
<path d="M70,447 L116,484 M130,447 V478 M190,447 L144,484" class="sch-main"/>
<circle cx="130" cy="500" r="22" class="sch-coil"/><text x="130" y="506" class="sch-in">M</text>
<text x="160" y="506" class="sch-sm">3φ 電動機</text>
<path d="M108,500 H86 V516 M78,516 H94 M81,520 H91 M84,524 H88" class="sch-main"/>
<path d="M116,516 L70,557 M130,522 V557 M144,516 L190,557" class="sch-main"/>
<rect x="45" y="548" width="170" height="24" class="sch-box"/>
<circle cx="70" cy="560" r="3" class="sch-open"/><circle cx="130" cy="560" r="3" class="sch-open"/><circle cx="190" cy="560" r="3" class="sch-open"/>
<text x="76" y="557" class="sch-sm">X</text><text x="136" y="557" class="sch-sm">Y</text><text x="196" y="557" class="sch-sm">Z</text>
<text x="222" y="565" class="sch-lbl">TB2</text>
<path d="M240,514 H260 M240,526 H260 M280,514 H300 M280,526 H300 M320,514 H340 M320,526 H340" class="sch-plate"/>
<text x="345" y="512" class="sch-lbl">MCD</text>
<path d="M250,526 V588 H130 M290,526 V612 H70 M330,526 V600 H190" class="sch-main"/>
<circle cx="130" cy="588" r="3" class="sch-dot"/><circle cx="70" cy="612" r="3" class="sch-dot"/><circle cx="190" cy="600" r="3" class="sch-dot"/>
<path d="M70,563 V634 M130,563 V634 M190,563 V634" class="sch-main"/>
<path d="M60,634 H80 M60,646 H80 M120,634 H140 M120,646 H140 M180,634 H200 M180,646 H200" class="sch-plate"/>
<path d="M70,646 V662 H190 V646 M130,646 V662" class="sch-main"/>
<circle cx="130" cy="662" r="3" class="sch-dot"/>
<text x="205" y="644" class="sch-lbl">MCS</text>
<text x="235" y="676" class="sch-sm">MCD 閉合 → Δ　MCS 閉合 → Y</text>`,
    hot: [
      ['TB1', 40, 40, 200, 36], ['NFB', 55, 88, 170, 42], ['MCF', 50, 226, 190, 28], ['MCR', 232, 216, 150, 38],
      ['THRY', 55, 382, 200, 36], ['TB2', 40, 428, 200, 32], ['TB2', 40, 544, 200, 32], ['MCD', 232, 502, 150, 32], ['MCS', 50, 626, 190, 44],
    ],
  },
};
