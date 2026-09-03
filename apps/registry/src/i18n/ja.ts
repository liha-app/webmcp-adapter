import type { MessageKey } from './en';

/**
 * 日本語。
 *
 * `Record<MessageKey, string>` として型付けしてあるので、英語側にキーを足して
 * こちらを忘れると型エラーになる。翻訳漏れが本番に出ることはない。
 *
 * Adapter が持っている文字列（名前・説明・ツールの説明）は翻訳しない。あれは
 * 公開された定義そのもので、ストアの掲載文と同じく書いた人の言語のまま出す。
 */
export const ja: Record<MessageKey, string> = {
  'meta.title': 'Liha WebMCP Adapter — サイトを変えずにエージェント対応へ',
  'meta.description':
    'WebMCPを実装していないWebサイトに、監査可能なWebMCPツールを追加します。宣言的・オリジン限定・オープンソース。',

  /* ------------------------------------------------------------- chrome -- */
  'nav.adapters': 'Adapter',
  'nav.how': '仕組み',
  'nav.trust': '信頼モデル',
  'nav.github': 'GitHub',
  'nav.appearance': '外観',
  'nav.themeAuto': '自動',
  'nav.themeLight': 'ライト',
  'nav.themeDark': 'ダーク',
  'nav.language': '言語',

  'status.checking': 'WebMCPを確認しています…',
  'status.supported': 'WebMCP準備完了 — このレジストリはエージェントに{0}個のツールを公開しています。',
  'status.unsupported':
    'このブラウザではWebMCPを利用できません。chrome://flags/#enable-webmcp-testing を有効にすると、エージェントがこのページを直接操作できます。',

  'footer.readable':
    'ここにあるAdapterはすべてリポジトリ内のJSONファイルです。AdapterにJavaScriptは含まれません — インストールする前に中身を読んでください。',
  'footer.mainWorld':
    'これらのツールを登録するランタイムは、ページ自身のJavaScriptワールドに置かれます。WebMCPに到達できる場所がそこしかないからです。悪意あるページからはランタイムが見えます。このトレードオフは隠さず文書化しています。',
  'footer.mit': 'MITライセンス',
  'footer.source': 'ソース',
  'footer.security': 'セキュリティ',
  'footer.format': 'Adapterフォーマット',
  'footer.apiNotes': 'WebMCP API調査メモ',
  'footer.disclaimer':
    'Apple Inc. およびApp Storeとは一切関係がなく、承認も受けていません。レイアウトはAppleが公開しているデザイン上の慣習に倣っていますが、名称・図版・文章はすべて本プロジェクト独自のものです。',

  'create.onboardChip': 'エージェントに Adapter Studio を教える',
  'create.recorderTitle': 'あるいは、自分で記録する。',
  'create.recorderLede':
    'Studioがページ上の操作を見て、同じJSONを書きます。7ステップで、最初の2つはブラウザの準備です。',

  /* ------------------------------------------------- build with an agent -- */
  'agent.s1': '頼む',
  'agent.s1Body':
    'サイトを開いて、セレクタではなく「やりたいこと」を伝えます。上のプロンプトが下準備をします。',
  'agent.starterTask':
    'そのうえで、いま開いているサイト向けのAdapterを作ってください。必要なツールはこれから伝えるので、聞いてください。',
  'agent.s2': '書く',
  'agent.s2Body':
    '1タスク1ツール。人が使うのと同じコントロールを通します。コードは書けません — この形式にコードを載せられるステップは存在しないからです。',
  'agent.s3': '検証する',
  'agent.s3Body':
    'validate_adapter はこのページのWebMCPツールなので、エージェントが直接呼んでエラーをテキストで受け取れます。下の入力欄は同じ検証器で、自分の目で見たいとき用です。',
  'agent.s4': 'インストール',
  'agent.s4Body':
    'インストールは拡張機能を通ります。拡張機能が自前のウィンドウで、対象originと権限をすべて提示して確認します。このページが単独で何かをインストールすることはありません。',
  'agent.paste': '下書きを貼り付ける',
  'agent.pillValid': '有効',
  'agent.pillProblems': '問題 {0} 件',
  'agent.stepCount': '{0} ステップ',
  'agent.railWebmcp': 'WebMCP',
  'agent.railExtension': '拡張機能',
  'agent.validate': '検証する',
  'agent.download': 'JSONをダウンロード',
  'agent.install': 'インストール',
  'agent.installing': '拡張機能の応答待ち…',
  'agent.installed': 'インストールしました。サイトを再読み込みすればツールが出ます。',
  'agent.noExtension':
    'このブラウザに拡張機能が入っていません。先に入れてから戻ってきてください。JSONをダウンロードして拡張機能から読み込むこともできます。',
  'agent.notJson': 'JSONとして読めません：',
  'agent.effects': '全ツール合計でクリック{0}回、入力{1}回、読み取り{2}回。',

  /* --------------------------------------------------------------- hero -- */
  'onboard.chip': 'エージェントに Liha WebMCP Adapter を教える',
  'onboard.agentsTitle': 'URLを取得できるエージェントなら何でも',
  'onboard.copied': 'コピーしました。エージェントに貼り付けてください。',
  'onboard.fallback': 'これをコピーしてエージェントに貼り付けてください：',
  'hero.eyebrow': 'Liha WebMCP Adapter',
  'hero.headline': 'サイトを変えずに、エージェント対応へ。',
  'hero.copy': 'WebMCPを実装していないWebサイトに、WebMCPツールを追加します。',
  'hero.tryDemo': 'デモを試す',
  'hero.install': '拡張機能を入れる',
  'hero.github': 'GitHubで見る',
  'hero.note':
    'Chrome 151以降 + WebMCPフラグが必要です。オープンソース（MIT）。どのAdapterもインストール前に中身を読めます。',

  /* --------------------------------------------------------- live panel -- */
  'live.headline': 'このページにはWebMCPツールがあります。呼んでみてください。',
  'live.copy':
    'このレジストリはWebMCPをネイティブに実装しています — サイトの開発者自身が対応するとこうなる、という見本です。ツールを選んで実行すると、下に出るのは実際のカタログからの応答です。ブラウザがAPIを持っていれば呼び出しは本当に{0}を通り、持っていなければ、そう正直に表示します。',
  'live.factRegisteredFigure': '{0}個のツール',
  'live.factRegisteredLabel':
    'をこのページが読み込み時に登録しています。入力スキーマ付きで、どのWebMCPエージェントからも発見できます。',
  'live.factZeroFigure': '0個のツール',
  'live.factZeroLabel':
    'しか3つのデモアプリは登録していません。WebMCPのコードを一切持たず、ツールは外側のAdapterから届きます。',
  'live.browseAdapters': 'Adapterを見る',
  'live.asAgentSees': 'エージェントが受け取るままのツール定義',
  'live.noArgs': 'このツールに引数はありません。',
  'live.run': '{0} を実行',
  'live.running': '実行中…',
  'live.willRunWebmcp': 'document.modelContext 経由で実行されます',
  'live.willRunDirect': 'このブラウザにWebMCPはありません — 同じ関数を直接実行します',
  'live.executedWebmcp': 'WebMCP経由で実行',
  'live.executedDirect': '直接実行',

  /* ------------------------------------------------------------ problem -- */
  'problem.headline': 'WebMCPの普及を、サイト運営者だけに任せない。',
  'problem.p1':
    'ネイティブWebMCPは、各サイトの開発者が{0}を実装して初めて使えます。それまでは、エージェントがスクリーンショットと推測に逆戻りします。',
  'problem.p2':
    'Lihaは、その作業を読めるAdapterへ移します。対象サイトを変更せず、エージェントには名前とスキーマを持つツールを渡します。',
  'problem.today': '今日',
  'problem.withAdapter': 'Adapterがあれば',
  'problem.factNoChangeFigure': '改修ゼロ',
  'problem.factNoChangeLabel':
    '対象サイトには何も要りません。SDKもscriptタグも、運営者の協力もアカウントも不要です。',
  'problem.factYourCallFigure': '決めるのはあなた',
  'problem.factYourCallLabel':
    'Adapterが動くのは、あなたがインストールしたからです。動く範囲は宣言されたオリジンだけで、拡張機能が事前に到達範囲を提示します。',

  'flow.websiteDeveloper': 'サイト開発者',
  'flow.registerTool': 'registerTool()',
  'flow.agent': 'エージェント',
  'flow.existingWebsite': '既存のWebサイト',
  'flow.communityAdapter': '確認できるAdapter',
  'flow.extension': '拡張機能',
  'flow.webmcpAgent': 'WebMCPエージェント',

  /* ------------------------------------------------------------ adapter -- */
  'adapter.headline': 'Adapterの実体はJSONファイル。それこそが要点です。',
  'adapter.copy':
    'stepの語彙は閉じています — click、fill、select、waitFor と、あといくつか。{0}ステップも式言語もなく、それを表現する手段自体がありません。だからこそ、コミュニティが投稿したAdapterのレジストリが、マルウェアの配布経路ではなく「読んで判断できるもの」になります。以下は実在するツールの最初の{1}ステップ、無編集です。',
  'adapter.noteCapabilityLabel': 'capability',
  'adapter.noteCapability':
    'はツールごとに宣言します。DESTRUCTIVEは必ず事前にユーザーへ確認し、WRITEも確認を要求するよう設定できます。',
  'adapter.noteStepsLabel': 'steps',
  'adapter.noteSteps':
    'は1ステップにつき要素を1つだけ指すこと。セレクタが0個や5個にマッチしたら、どのボタンかを推測せずに失敗します。',
  'adapter.notePlaceholdersLabel': '{{placeholders}}',
  'adapter.notePlaceholders':
    'は値にだけ展開され、セレクタには決して展開されません。ツールの引数でstepの対象を差し替えることはできません。',
  'adapter.noteRestLabel': '残りは',
  'adapter.noteRest':
    '、作成した顧客を引き直す読み取りstepが{0}個。「たぶん成功した」で済ませず、実際に作られたものを報告するためです。',
  'adapter.seeWhole': 'Adapter全体を見る',
  'adapter.readFormat': 'フォーマット仕様を読む',

  /* ----------------------------------------------------------------- how -- */
  'how.headline': 'どうやってページに届くのか',
  'how.copy':
    '拡張機能はAdapterを検証したうえで、小さなランタイムをページ自身のJavaScriptワールド — {0}に到達できる唯一の場所 — に注入し、そこで各ツールを登録します。エージェントから見えるのは、ごく普通のWebMCPツールです。呼び出されるとAdapterのstepがサイト本来のフォームを操作するので、アプリ自身のロジックが人間の操作とまったく同じように動きます。',
  'how.stepAdapterJson': 'Adapter JSON',
  'how.stepAdapterJsonDetail': '宣言的・オリジン限定',
  'how.stepExtension': 'Chrome拡張機能',
  'how.stepExtensionDetail': '検証してから注入',
  'how.stepMainWorld': 'MAIN world',
  'how.stepMainWorldDetail': 'ページ自身のJavaScriptワールド',
  'how.stepRegister': 'registerTool()',
  'how.stepRegisterDetail': 'document.modelContext',
  'how.stepAgent': 'エージェント',
  'how.stepAgentDetail': '名前の付いた能力を発見',
  'how.notAutomationTitle': 'これは「ひと手間増えたブラウザ自動化」ではありません。',
  'how.notAutomationCopy':
    '自動化は実行のたびにクリック先を導出し直すため監査しづらく、権限という概念も持ちません。ここでの出力はクリックではなく、JSON入力スキーマとcapability分類を備え、一度書けば誰でもレビューできる、名前の付いた能力です。',
  'how.factStepsFigure': '{0}種類のstep',
  'how.factStepsLabel':
    'が語彙のすべてです — {0}、ほか{1}種類。そのどれもコードを実行できないので、読んでいないスクリプトが走るAdapterというものが存在しません。',

  /* --------------------------------------------------------------- demos -- */
  'demos.headline': '普通のWebアプリが3つ。WebMCPコードはゼロ。',
  'demos.copy':
    '外側から、Adapter {0}個がツール{1}個を追加します。デモアプリが{2}を呼んでいないことはCIで検証しています。',
  'demos.open': '{0} を開く',
  'demos.adapter': 'Adapter',
  'demos.blurbCrm': '追加・編集ダイアログ付きの顧客一覧。ごく普通のCRUD、ごく普通のReactです。',
  'demos.blurbShop': 'チップ・メモリ・ストレージを選んで構成し、バッグに入れ、クーポンを適用し、注文内容を確認するまで。確認で止まります — 決済のステップは意図的にありません。',
  'demos.blurbProject':
    '担当者とステータスを持つタスク管理。削除もあるので、破壊的ツールが確認を求める様子を見られます。',
  'demos.noteProject': 'DESTRUCTIVEの確認ダイアログを見るならこれ。',

  /* --------------------------------------------------------------- setup -- */
  'setup.headline': 'デモを動かす前に。',
  'setup.copy': '今のChromeではWebMCPはフラグの内側にあるので、先に1つだけスイッチを入れます。',
  'setup.step1': 'Google Chrome 151以降を使う。',
  'setup.step2': 'WebMCPフラグを有効にして再起動する。',
  'setup.step3':
    '拡張機能を読み込む: ダウンロードして展開し、chrome://extensions でデベロッパーモードをオンにして「パッケージ化されていない拡張機能を読み込む」。',
  'setup.step4': '下のデモをどれか開く。',
  'setup.step5': 'Lihaのポップアップを確認する — Adapterが有効で、ツールが登録されているはずです。',
  'setup.step6': 'WebMCPエージェントに指示する。例:「Alice Smithという顧客を作って」',
  'setup.download': '拡張機能をダウンロード',
  'setup.buildFromSource': 'ソースからビルドする',

  /* ------------------------------------------------------------ recorder -- */
  'recorder.headline': '自分でサイトを操作して、エージェントに教える。',
  'recorder.copy':
    '操作を一度実演し、記録された宣言的stepを確認して、名前の付いたWebMCPツールとしてインストールします。入力値は引数に、安定したページ属性はセレクタになります。Agentが操作をでっち上げることはありません。',
  'recorder.step1Title': '記録する',
  'recorder.step1': '拡張機能のポップアップで記録を開始します。',
  'recorder.step2Title': 'サイトを使う',
  'recorder.step2': 'いつもどおりクリックして入力するだけです。',
  'recorder.step3Title': 'stepを確認する',
  'recorder.step3': '各セレクタが何個の要素にマッチしたかが表示されます。',
  'recorder.step4Title': '引数にする',
  'recorder.step4': '入力した値がツールの引数になり、その文字列はサンプルとして残ります。',
  'recorder.step5Title': 'セレクタを検証する',
  'recorder.step5': '実際のページに対して、単一マッチになるか確かめます。',
  'recorder.step6Title': 'インストールする',
  'recorder.step6': '到達範囲を承認すると、WebMCPツールになります。',

  /* ------------------------------------------------------------ verified -- */
  'verified.headline': '実際に確認できていること。',
  'verified.copy':
    'ページの外にいる実在のエージェントが、DevToolsのWebMCPドメイン — Tool Inspectorが使うのと同じ面 — を通してこれらのツールを発見し、呼び出しています。{0}',
  'verified.ciNote': 'pushのたびに、実ブラウザでの実行も含めてすべてをクリーンな環境で回しています。',
  'verified.fact1': 'Chrome拡張機能が、ページのMAIN worldにランタイムを注入する。',
  'verified.fact2': 'そのランタイムが document.modelContext.registerTool() を呼ぶ。',
  'verified.fact3': 'ページ外のWebMCPエージェントが、スキーマ付きでツールを発見する。',
  'verified.fact4': 'エージェントが呼び出し、サイト本来のフォームが入力・送信される。',
  'verified.fact5': '3つのデモアプリにWebMCPコードは一切ない — CIで検証済み。',
  'verified.runPhase0': 'Phase 0 の受け入れ基準',
  'verified.runPhase0What': '中核仮説を端から端まで',
  'verified.runFull': 'システム全体',
  'verified.runFullWhat': 'Adapter3種、ポータル、確認ゲート',
  'verified.runRecorder': 'RecorderとStudio',
  'verified.runRecorderWhat': '操作を記録して、妥当なAdapterを得る',
  'verified.factUnitLabel':
    '件のユニット/インテグレーションテスト。インテグレーション層は実物のデモアプリをマウントし、公開中の実物のAdapterを走らせるので、対象サイトとズレたAdapterはそこで落ちます。',
  'verified.factE2eLabel':
    '件の実ブラウザE2Eテスト。加えて、DevToolsプロトコル経由でChromeを操作する受け入れテストが3本あります。',
  'verified.summary':
    '実在するエージェントが、通常のWebサイトに対してAdapterを発見し呼び出します。同じ経路を、公開中の定義とデモアプリに対してCIでも実行しています。',
  'verified.factAdapters': '公開Adapter',
  'verified.factTools': 'Adapterツール',
  'verified.factUnitShort': 'ユニット＋統合テスト',
  'verified.factE2eShort': '実ブラウザE2E',

  /* ------------------------------------------------------------ security -- */
  'security.headline': '監査できる。オリジンに限定される。権限を意識している。',
  'security.copy':
    '「安全です」とは言いません。現実的な最悪ケースは、コミュニティのAdapterがブラウザ内マルウェアになることです。だからフォーマット側で、それを表現できないか、インストール前に見えるかのどちらかにしてあります。',
  'security.summary':
    'Adapterはコードではなくデータです。すべてのstep・オリジン・capabilityをインストール前に確認でき、危険なパターンは実行前の検証で拒否されます。',
  'security.point1': 'フォーマットのどこにも実行可能なJavaScriptはない — DSLがそれを表現できない。',
  'security.point2': 'オリジンは完全一致のみ。ワイルドカードは警告ではなく検証で拒否する。',
  'security.point3': 'パスワード・カード番号などの機微なフィールドには一切触れない。',
  'security.point4': '入力値をログやトレースに書き出さない。',
  'security.point5': '破壊的な操作は毎回、必ず事前に確認する。',
  'security.limitTitle': '設計では消せない限界。',
  'security.limitCopy':
    'WebMCPツールはページ自身のJavaScriptワールドで登録するしかないので、拡張機能のランタイムもそこに置かれます。悪意あるページからは、それが見え、呼べ、書き換えられます。ランタイムは拡張機能の権限を一切持たないため、ページにできる最悪のことは自分自身のDOMを操作すること — もともとできること — にとどまります。とはいえ拡張機能が普段与えてくれる分離はここでは効きません。そこは織り込んで判断してください。',
  'security.limitShort':
    'WebMCPに到達するため、ランタイムはページ自身のJavaScriptワールドに置かれます。そのトレードオフと限界は脅威モデルに明記しています。',
  'security.threatModel': '脅威モデル全文を読む',

  /* --------------------------------------------------------------- close -- */
  'close.headline': 'すべてのWebサイトがWebMCPを採用するのを待つ必要はありません。',
  'close.copy': 'そのWebサイトはWebMCPを実装しませんでした。Liha Adapterが実装しました。',
  'close.note':
    'オープンソース（MIT） — 拡張機能、ランタイム、DSL、レジストリ、Recorder、デモアプリ、テストのすべて。',

  /* --------------------------------------------------------------- store -- */
  'store.title': 'Adapter',
  'store.sub':
    'どれも宣言的なJSONで、完全一致のオリジンに限定されています。すべてのstepと権限を、インストール前に確認できます。',
  'store.search': '検索',
  'store.searchLabel': 'Adapterを検索',
  'store.category': 'カテゴリ',
  'store.capability': 'capability',
  'store.allAdapters': 'すべてのAdapter',
  'store.anyCapability': 'すべてのcapability',
  'store.featureKicker': '公式コレクション',
  'store.featureHeadline': 'Adapter {0}個、ツール{1}個。そのどこにもJavaScriptは1行もありません。',
  'store.featureCopy':
    'stepの語彙には{0}も式言語もありません。だからコミュニティのAdapterは、信用するしかないものではなく、読めるものになります。',
  'store.shelfMatching': '条件に合うAdapter',
  'store.count': '{0}件',
  'store.countOne': '1件',
  'store.toolCount': 'ツール{0}個',
  'store.view': '見る',
  'store.open': '開く',
  'store.noResults': '条件に合うAdapterはありません。',
  'store.demoShelf': '今すぐ操作できるサイト',
  'store.demoShelfLink': '事前に必要なもの',
  'store.noOwnWebmcp': 'WebMCPコードを持たない',
  'store.extShelf': '拡張機能',
  'store.extBuild': 'ソースからビルド',
  'store.extName': 'Liha WebMCP Adapter for Chrome',
  'store.extSub':
    'Adapterを検証し、そのツールをページに登録します。Chrome 151以降 + WebMCPフラグが必要です。',
  'store.extFirefox': 'Firefox版も同梱',
  'store.get': '入手',
  'store.installed': 'インストール済み',

  /* -------------------------------------------------------------- detail -- */
  'detail.notFound': 'そのidのAdapterはありません。',
  'detail.back': 'レジストリに戻る',
  'detail.install': 'インストール',
  'detail.reinstall': '再インストール',
  'detail.installing': '確認を待っています…',
  'detail.installedHere': 'このブラウザにインストール済みです。',
  'detail.willShowPermissions': 'インストール前に、拡張機能が権限の内容を表示します。',
  'detail.installOk': 'インストールしました。対象サイトを再読み込みするとツールを使えます。',
  'detail.factTools': 'ツール',
  'detail.factCapability': '最も強いcapability',
  'detail.factOrigins': 'オリジン',
  'detail.factOriginsNote': '完全一致・ワイルドカードなし',
  'detail.factVersion': 'バージョン',
  'detail.factVerified': '最終検証日',
  'detail.notVerified': '未検証',
  'detail.healthInBrowser': 'このブラウザでは{0}',
  'detail.reachTitle': '到達できる範囲',
  'detail.reachCopy':
    'このAdapterが動くのは、ここに挙げた完全一致のオリジンだけです。それ以外では動かず、そこから外へ遷移することもできません。',
  'detail.destructiveWarn': '破壊的なツールが{0}個あります（{1}）。実行前に必ず確認を求めます。',
  'detail.destructiveWarnOne': '破壊的なツールが1個あります（{1}）。実行前に必ず確認を求めます。',
  'detail.toolsTitle': 'ツール',
  'detail.does': '動作: {0} — 宣言的step {1}個',
  'detail.inputSchema': '入力スキーマ',
  'detail.sourceTitle': 'ソース',
  'detail.sourceCopy':
    '公開場所は {0} です。読めないAdapterはインストールすべきでないAdapterなので、定義の全文をここに置いています。隠れたコードはありません — フォーマットがそれを表現できないからです。',
  'detail.showSource': '定義の全文を表示',
  'detail.hideSource': '定義の全文を隠す',

  /* -------------------------------------------------------------- health -- */
  'health.healthy': '正常',
  'health.degraded': '一部劣化',
  'health.broken': '故障',
  'health.unknown': '未確認',
  'health.title': 'お使いのブラウザ拡張機能が、実際のサイトに対して報告した結果です',

  /* -------------------------------------------- the guided build ---- */
  'nav.create': '作ってみる',
  'create.eyebrow': 'Adapter Studio',
  'create.headline': 'WebMCP を持たないサイトに、WebMCP ツールを作る。',
  'create.lede':
    '道は二つ、行き着くJSONは同じです。エージェントに頼むか、自分で操作を記録するか。どちらもコードは書かず、サイトにも手を入れません。',
  'create.copy': 'コピー',
  'create.copied': 'コピーしました',
  'create.copyFailed': 'コピーできませんでした',
  'create.done': '完了',
  'create.watching': '確認中',
  'create.step1': 'WebMCP を有効にする',
  'create.step1Body':
    'Chrome はこの API をフラグの裏に置いています。アドレスバーに貼り付けて Enabled にし、再起動してください。API が見つかればこのステップは自動で埋まります。',
  'create.copyFlag': 'フラグURLをコピー',
  'create.step2': '拡張機能を入れる',
  'create.step2Body':
    'zip を展開し、chrome://extensions でデベロッパーモードを有効にして「パッケージ化されていない拡張機能を読み込む」。拡張機能が応答すれば自動で埋まります。',
  'create.getExtension': '拡張機能をダウンロード',
  'create.step3': '教えたいサイトを開く',
  'create.step3Body':
    '拡張機能が到達できるサイトなら何でも構いません。下のストアフロントは、まだ誰も Adapter を書いていないサイトです。別タブで開いたままにしてください。記録が聞いているのはそのタブで、このページではありません。',
  'create.openDemo': '{0} を開く',
  'create.step4': '自分でやる操作を記録する',
  'create.step4Body': 'ここは別タブでの作業なので、このページからは見えません。そちらで Liha のアイコンを押して:',
  'create.step4a': '「ツールを記録」を押す。',
  'create.step4b': '実際にやる — 検索する、フォームを埋める、そのツールにやらせたいことを。',
  'create.step4c': '「記録を停止」を押す。操作を持った状態で Studio が開きます。',
  'create.step5': 'Studio で整える',
  'create.step5Body': '記録はまだ素材です。エージェントに渡せるツールにするのは、次の4つです:',
  'create.step5a':
    'snake_case で名前を付け、説明を書く。エージェントはその説明を読んで、いつこのツールを使うかを判断します。',
  'create.step5b': '打ち込んだ値を引数にする。あれは例であって、定数ではありません。',
  'create.step5c':
    '誰もクリックしていないステップを足す。結果を読み取るのは操作ではないので、記録には残りません。readText か readList を足して初めて、ツールは値を返します。',
  'create.step5d': '「セレクタを検査」を押す。2要素に一致するセレクタは実行時に拒否されるので、ここで気づいてください。',
  'create.step6': 'インストールする',
  'create.step6Body':
    '「ローカルにインストール」を押します。拡張機能が定義を再検証し、対象オリジンと capability を明示して承認を求めます。求めるのは要求であって、決めるのはあなたです。入ったらこのページが気づきます。',
  'create.step7': '呼んでみる',
  'create.step7Body': '{0} に戻ってコンソールを開き、これを実行してください。あなたのツールを、あなたの引数で呼びます。',
  'create.step7Waiting': 'Adapter がインストールされると、それを実行するコードがここに出ます。',
  'create.staleExtension':
    'お使いの拡張機能はこのページより古く、インストール済みの内容を報告できません。更新するとこのステップが動き始めます。それ以外はそのまま使えます。',
  'create.copySnippet': 'コードをコピー',
  'create.footnote':
    '同じ定義はファイルとして持ち出せます。Studio の「JSON を書き出す」で公開でき、「native WebMCP を書き出す」ではサイト自身の開発者が実装するコード — Adapter を不要にする版 — が出てきます。',
};
