"""App Store Connect localization data for Mango.

All translations for 13 locales: metadata, screenshot captions, and in-app labels.
Review translations with native speakers before publishing.
"""

# Screenshot scene configs (shared across all locales — defines the UI mock)
SCREENSHOT_CONFIGS = [
    {
        "suffix": "1_welcome",
        "scene": "welcome",
    },
    {
        "suffix": "2_browse",
        "scene": "browse",
    },
    {
        "suffix": "3_query",
        "scene": "query",
    },
    {
        "suffix": "4_edit",
        "scene": "edit",
    },
    {
        "suffix": "5_native",
        "scene": "native",
    },
]

# Mango brand colors
MANGO_ORANGE = (242, 148, 46)
MANGO_BG = (255, 250, 242)
MANGO_SIDEBAR_BG = (248, 243, 235)
MANGO_DARK = (40, 40, 40)
MANGO_GRAY = (140, 140, 140)

# ---------------------------------------------------------------------------
# Locale data
# ---------------------------------------------------------------------------
# Each locale entry has:
#   name          — localized app name (<=30 chars)
#   subtitle      — localized subtitle (<=30 chars)
#   keywords      — comma-separated, no spaces after commas (<=100 chars)
#   promotional_text — short promo (<=170 chars)
#   description   — full App Store description (<=4000 chars)
#   whats_new     — release notes
#   screenshots   — list of 5 dicts with caption (marketing text above phone frame)
#   script        — font script family: "latin", "ja", "zh-Hans", "ko", "th"

LOCALES = {

    # -----------------------------------------------------------------------
    "en-US": {
        "name": "Mango — MongoDB Client",
        "subtitle": "Browse. Query. Edit.",
        "keywords": "mongodb,database,nosql,query,document,collection,json,gui,client,db,mongo",
        "promotional_text": (
            "The MongoDB client that just works. No Electron, no bloat. "
            "Native speed on macOS, iOS, Android, Linux, and Windows."
        ),
        "description": (
            "Browse databases, query collections, and edit documents — "
            "all from a fast, native app that feels right at home on every platform.\n\n"
            "Mango is a lightweight MongoDB GUI built with native controls. "
            "No Electron. No web views. Just a real native app that starts instantly "
            "and uses a fraction of the memory.\n\n"
            "BROWSE & EXPLORE\n"
            "See all your databases and collections in a clean sidebar. "
            "Expand any database to browse its collections. Tap to query.\n\n"
            "QUERY WITH EASE\n"
            "Enter a filter, sort, or projection — or just tap Run Query to see everything. "
            "Results appear instantly with formatted key-value display.\n\n"
            "EDIT DOCUMENTS\n"
            "View, edit, duplicate, or delete any document. "
            "Full JSON editing with syntax validation.\n\n"
            "VIEW INDEXES\n"
            "See all indexes on any collection at a glance.\n\n"
            "CONNECT SECURELY\n"
            "Save connection profiles with SCRAM-SHA-256 authentication and TLS support. "
            "Passwords stored securely in the system keychain.\n\n"
            "DARK & LIGHT MODE\n"
            "Follows your system preference automatically.\n\n"
            "Native on macOS, iOS, Android, Linux, and Windows.\n\n"
            "One price. All features. All platforms."
        ),
        "whats_new": "Bug fixes and performance improvements.",
        "screenshots": [
            {"caption": "Browse your databases\nat a glance"},
            {"caption": "Query collections\nwith ease"},
            {"caption": "Edit documents\ninstantly"},
            {"caption": "Connect securely\nin seconds"},
            {"caption": "Native speed.\nNo Electron.\nJust MongoDB."},
        ],
        "script": "latin",
    },

    # -----------------------------------------------------------------------
    "de-DE": {
        "name": "Mango — MongoDB Client",
        "subtitle": "Durchsuchen. Abfragen. Edits.",
        "keywords": "mongodb,datenbank,nosql,abfrage,dokument,collection,json,gui,client,db,mongo",
        "promotional_text": (
            "Der MongoDB-Client, der einfach funktioniert. Kein Electron, kein Ballast. "
            "Native Geschwindigkeit auf macOS, iOS, Android, Linux und Windows."
        ),
        "description": (
            "Datenbanken durchsuchen, Collections abfragen und Dokumente bearbeiten — "
            "alles in einer schnellen, nativen App, die sich auf jeder Plattform wie zu Hause anfuehlt.\n\n"
            "Mango ist ein leichtgewichtiger MongoDB-GUI, gebaut mit nativen Steuerelementen. "
            "Kein Electron. Keine Web Views. Einfach eine echte native App, die sofort startet "
            "und nur einen Bruchteil des Speichers braucht.\n\n"
            "DURCHSUCHEN & ERKUNDEN\n"
            "Sieh alle Datenbanken und Collections in einer uebersichtlichen Seitenleiste. "
            "Erweitere eine Datenbank, um ihre Collections zu sehen. Tippe zum Abfragen.\n\n"
            "EINFACH ABFRAGEN\n"
            "Gib einen Filter, eine Sortierung oder Projektion ein — oder tippe einfach auf "
            "Abfrage ausfuehren, um alles zu sehen. Ergebnisse erscheinen sofort formatiert.\n\n"
            "DOKUMENTE BEARBEITEN\n"
            "Dokumente anzeigen, bearbeiten, duplizieren oder loeschen. "
            "Vollstaendige JSON-Bearbeitung mit Syntaxvalidierung.\n\n"
            "INDIZES ANZEIGEN\n"
            "Alle Indizes einer Collection auf einen Blick.\n\n"
            "SICHER VERBINDEN\n"
            "Verbindungsprofile mit SCRAM-SHA-256-Authentifizierung und TLS speichern. "
            "Passwoerter sicher im System-Schluesselring gespeichert.\n\n"
            "HELL & DUNKEL\n"
            "Folgt automatisch deiner Systemeinstellung.\n\n"
            "Nativ auf macOS, iOS, Android, Linux und Windows.\n\n"
            "Ein Preis. Alle Funktionen. Alle Plattformen."
        ),
        "whats_new": "Fehlerbehebungen und Leistungsverbesserungen.",
        "screenshots": [
            {"caption": "Deine Datenbanken\nauf einen Blick"},
            {"caption": "Collections abfragen\n— ganz einfach"},
            {"caption": "Dokumente bearbeiten\n— sofort"},
            {"caption": "Sicher verbinden\nin Sekunden"},
            {"caption": "Native Geschwindigkeit.\nKein Electron.\nNur MongoDB."},
        ],
        "script": "latin",
    },

    # -----------------------------------------------------------------------
    "ja": {
        "name": "Mango — MongoDB Client",
        "subtitle": "閲覧。クエリ。編集。",
        "keywords": "mongodb,データベース,nosql,クエリ,ドキュメント,コレクション,json,gui,クライアント,db,mongo",
        "promotional_text": "ただ動くMongoDBクライアント。Electronなし、無駄なし。macOS、iOS、Android、Linux、Windowsでネイティブ速度。",
        "description": (
            "データベースを閲覧、コレクションをクエリ、ドキュメントを編集 — "
            "すべてのプラットフォームで快適に動作する高速ネイティブアプリで。\n\n"
            "MangoはネイティブコントロールでビルドされたシンプルなMongoDB GUIです。"
            "Electronなし。Web Viewなし。瞬時に起動し、メモリ消費も最小限の本物のネイティブアプリ。\n\n"
            "閲覧 & 探索\n"
            "すべてのデータベースとコレクションをすっきりしたサイドバーで確認。"
            "データベースを展開してコレクションを閲覧。タップしてクエリ。\n\n"
            "簡単クエリ\n"
            "フィルター、ソート、プロジェクションを入力 — またはクエリ実行をタップして全件表示。"
            "結果はフォーマットされたキー・バリュー表示で即座に表示。\n\n"
            "ドキュメント編集\n"
            "ドキュメントの表示、編集、複製、削除。構文検証付きのJSON編集。\n\n"
            "インデックス表示\n"
            "コレクションのすべてのインデックスを一目で確認。\n\n"
            "安全に接続\n"
            "SCRAM-SHA-256認証とTLSサポートで接続プロファイルを保存。"
            "パスワードはシステムキーチェーンに安全に保存。\n\n"
            "ダーク & ライトモード\n"
            "システム設定に自動で追従。\n\n"
            "macOS、iOS、Android、Linux、Windowsでネイティブ対応。\n\n"
            "ワンプライス。全機能。全プラットフォーム。"
        ),
        "whats_new": "バグ修正とパフォーマンスの改善。",
        "screenshots": [
            {"caption": "データベースを\n一目で確認"},
            {"caption": "コレクションを\n簡単にクエリ"},
            {"caption": "ドキュメントを\n即座に編集"},
            {"caption": "安全に接続\n数秒で完了"},
            {"caption": "ネイティブ速度。\nElectronなし。\nただのMongoDB。"},
        ],
        "script": "ja",
    },

    # -----------------------------------------------------------------------
    "zh-Hans": {
        "name": "Mango — MongoDB Client",
        "subtitle": "浏览。查询。编辑。",
        "keywords": "mongodb,数据库,nosql,查询,文档,集合,json,gui,客户端,db,mongo",
        "promotional_text": "真正好用的MongoDB客户端。无Electron、无臃肿。macOS、iOS、Android、Linux和Windows上原生速度。",
        "description": (
            "浏览数据库、查询集合、编辑文档 — "
            "在每个平台上都如鱼得水的快速原生应用。\n\n"
            "Mango是一个使用原生控件构建的轻量级MongoDB GUI。"
            "无Electron。无Web视图。一个真正的原生应用，瞬间启动，内存占用极低。\n\n"
            "浏览与探索\n"
            "在简洁的侧边栏中查看所有数据库和集合。展开数据库浏览其集合。点击即可查询。\n\n"
            "轻松查询\n"
            "输入筛选器、排序或投影 — 或直接点击运行查询查看全部。"
            "结果以格式化的键值对即时显示。\n\n"
            "编辑文档\n"
            "查看、编辑、复制或删除任何文档。带语法验证的完整JSON编辑。\n\n"
            "查看索引\n"
            "一目了然地查看集合上的所有索引。\n\n"
            "安全连接\n"
            "使用SCRAM-SHA-256认证和TLS保存连接配置。密码安全存储在系统钥匙串中。\n\n"
            "深色与浅色模式\n"
            "自动跟随系统设置。\n\n"
            "原生支持macOS、iOS、Android、Linux和Windows。\n\n"
            "一次付费。全部功能。全平台。"
        ),
        "whats_new": "错误修复和性能改进。",
        "screenshots": [
            {"caption": "一目了然\n浏览数据库"},
            {"caption": "轻松查询\n集合数据"},
            {"caption": "即时编辑\n文档内容"},
            {"caption": "安全连接\n数秒完成"},
            {"caption": "原生速度。\n无Electron。\n纯粹MongoDB。"},
        ],
        "script": "zh-Hans",
    },

    # -----------------------------------------------------------------------
    "es-MX": {
        "name": "Mango — MongoDB Client",
        "subtitle": "Explora. Consulta. Edita.",
        "keywords": "mongodb,base de datos,nosql,consulta,documento,coleccion,json,gui,cliente,db,mongo",
        "promotional_text": (
            "El cliente MongoDB que simplemente funciona. Sin Electron, sin sobrecarga. "
            "Velocidad nativa en macOS, iOS, Android, Linux y Windows."
        ),
        "description": (
            "Explora bases de datos, consulta colecciones y edita documentos — "
            "todo desde una app nativa y rapida que se siente como en casa en cada plataforma.\n\n"
            "Mango es un GUI ligero para MongoDB construido con controles nativos. "
            "Sin Electron. Sin web views. Una app nativa real que inicia al instante "
            "y usa una fraccion de la memoria.\n\n"
            "EXPLORAR\n"
            "Ve todas tus bases de datos y colecciones en una barra lateral limpia. "
            "Expande cualquier base de datos para ver sus colecciones.\n\n"
            "CONSULTAR CON FACILIDAD\n"
            "Ingresa un filtro, orden o proyeccion — o simplemente toca Ejecutar consulta. "
            "Los resultados aparecen al instante con formato clave-valor.\n\n"
            "EDITAR DOCUMENTOS\n"
            "Ver, editar, duplicar o eliminar cualquier documento. "
            "Edicion JSON completa con validacion de sintaxis.\n\n"
            "VER INDICES\n"
            "Ve todos los indices de cualquier coleccion de un vistazo.\n\n"
            "CONECTAR DE FORMA SEGURA\n"
            "Guarda perfiles de conexion con autenticacion SCRAM-SHA-256 y soporte TLS. "
            "Contrasenas almacenadas de forma segura en el llavero del sistema.\n\n"
            "MODO CLARO Y OSCURO\n"
            "Sigue tu preferencia del sistema automaticamente.\n\n"
            "Nativo en macOS, iOS, Android, Linux y Windows.\n\n"
            "Un precio. Todas las funciones. Todas las plataformas."
        ),
        "whats_new": "Correcciones de errores y mejoras de rendimiento.",
        "screenshots": [
            {"caption": "Explora tus bases de datos\nde un vistazo"},
            {"caption": "Consulta colecciones\ncon facilidad"},
            {"caption": "Edita documentos\nal instante"},
            {"caption": "Conecta de forma segura\nen segundos"},
            {"caption": "Velocidad nativa.\nSin Electron.\nSolo MongoDB."},
        ],
        "script": "latin",
    },

    # -----------------------------------------------------------------------
    "fr-FR": {
        "name": "Mango — Client MongoDB",
        "subtitle": "Parcourir. Requeter. Editer.",
        "keywords": "mongodb,base de donnees,nosql,requete,document,collection,json,gui,client,db,mongo",
        "promotional_text": (
            "Le client MongoDB qui fonctionne, tout simplement. Sans Electron, sans superflu. "
            "Vitesse native sur macOS, iOS, Android, Linux et Windows."
        ),
        "description": (
            "Parcourez les bases de donnees, interrogez les collections et modifiez les documents — "
            "le tout depuis une application native rapide, a l'aise sur chaque plateforme.\n\n"
            "Mango est un GUI MongoDB leger construit avec des controles natifs. "
            "Pas d'Electron. Pas de web views. Une vraie application native qui demarre instantanement "
            "et utilise une fraction de la memoire.\n\n"
            "PARCOURIR & EXPLORER\n"
            "Visualisez toutes vos bases de donnees et collections dans une barre laterale claire. "
            "Developpez une base pour voir ses collections.\n\n"
            "INTERROGER FACILEMENT\n"
            "Entrez un filtre, un tri ou une projection — ou appuyez simplement sur Executer. "
            "Les resultats s'affichent instantanement au format cle-valeur.\n\n"
            "MODIFIER LES DOCUMENTS\n"
            "Afficher, modifier, dupliquer ou supprimer n'importe quel document. "
            "Edition JSON complete avec validation syntaxique.\n\n"
            "VOIR LES INDEX\n"
            "Tous les index d'une collection en un coup d'oeil.\n\n"
            "CONNEXION SECURISEE\n"
            "Sauvegardez vos profils de connexion avec authentification SCRAM-SHA-256 et support TLS. "
            "Mots de passe stockes de maniere securisee dans le trousseau systeme.\n\n"
            "MODE CLAIR & SOMBRE\n"
            "Suit automatiquement votre preference systeme.\n\n"
            "Natif sur macOS, iOS, Android, Linux et Windows.\n\n"
            "Un prix. Toutes les fonctionnalites. Toutes les plateformes."
        ),
        "whats_new": "Corrections de bugs et ameliorations de performances.",
        "screenshots": [
            {"caption": "Parcourez vos bases\nen un coup d'oeil"},
            {"caption": "Interrogez vos collections\nfacilement"},
            {"caption": "Modifiez les documents\ninstantanement"},
            {"caption": "Connexion securisee\nen quelques secondes"},
            {"caption": "Vitesse native.\nSans Electron.\nJuste MongoDB."},
        ],
        "script": "latin",
    },

    # -----------------------------------------------------------------------
    "pt-BR": {
        "name": "Mango — Cliente MongoDB",
        "subtitle": "Navegar. Consultar. Editar.",
        "keywords": "mongodb,banco de dados,nosql,consulta,documento,colecao,json,gui,cliente,db,mongo",
        "promotional_text": (
            "O cliente MongoDB que simplesmente funciona. Sem Electron, sem inchaço. "
            "Velocidade nativa no macOS, iOS, Android, Linux e Windows."
        ),
        "description": (
            "Navegue por bancos de dados, consulte colecoes e edite documentos — "
            "tudo de um app nativo e rapido que se sente em casa em qualquer plataforma.\n\n"
            "Mango e um GUI MongoDB leve construido com controles nativos. "
            "Sem Electron. Sem web views. Um app nativo de verdade que inicia instantaneamente "
            "e usa uma fracao da memoria.\n\n"
            "NAVEGAR & EXPLORAR\n"
            "Veja todos os seus bancos de dados e colecoes em uma barra lateral limpa. "
            "Expanda qualquer banco para navegar pelas colecoes.\n\n"
            "CONSULTAR COM FACILIDADE\n"
            "Insira um filtro, ordenacao ou projecao — ou simplesmente toque em Executar consulta. "
            "Os resultados aparecem instantaneamente com exibicao chave-valor.\n\n"
            "EDITAR DOCUMENTOS\n"
            "Visualizar, editar, duplicar ou excluir qualquer documento. "
            "Edicao JSON completa com validacao de sintaxe.\n\n"
            "VER INDICES\n"
            "Veja todos os indices de qualquer colecao de relance.\n\n"
            "CONEXAO SEGURA\n"
            "Salve perfis de conexao com autenticacao SCRAM-SHA-256 e suporte TLS. "
            "Senhas armazenadas com seguranca no chaveiro do sistema.\n\n"
            "MODO CLARO & ESCURO\n"
            "Segue automaticamente sua preferencia do sistema.\n\n"
            "Nativo no macOS, iOS, Android, Linux e Windows.\n\n"
            "Um preco. Todos os recursos. Todas as plataformas."
        ),
        "whats_new": "Correcoes de bugs e melhorias de desempenho.",
        "screenshots": [
            {"caption": "Navegue seus bancos\nde relance"},
            {"caption": "Consulte colecoes\ncom facilidade"},
            {"caption": "Edite documentos\ninstantaneamente"},
            {"caption": "Conexao segura\nem segundos"},
            {"caption": "Velocidade nativa.\nSem Electron.\nSo MongoDB."},
        ],
        "script": "latin",
    },

    # -----------------------------------------------------------------------
    "ko": {
        "name": "Mango — MongoDB Client",
        "subtitle": "탐색. 쿼리. 편집.",
        "keywords": "mongodb,데이터베이스,nosql,쿼리,문서,컬렉션,json,gui,클라이언트,db,mongo",
        "promotional_text": "그냥 작동하는 MongoDB 클라이언트. Electron 없이, 군더더기 없이. macOS, iOS, Android, Linux, Windows에서 네이티브 속도.",
        "description": (
            "데이터베이스 탐색, 컬렉션 쿼리, 문서 편집 — "
            "모든 플랫폼에서 자연스럽게 느껴지는 빠른 네이티브 앱으로.\n\n"
            "Mango는 네이티브 컨트롤로 빌드된 경량 MongoDB GUI입니다. "
            "Electron 없음. 웹 뷰 없음. 즉시 시작되고 메모리를 거의 사용하지 않는 진짜 네이티브 앱.\n\n"
            "탐색 & 탐구\n"
            "깔끔한 사이드바에서 모든 데이터베이스와 컬렉션을 확인. "
            "데이터베이스를 펼쳐 컬렉션 탐색. 탭하여 쿼리.\n\n"
            "쉽게 쿼리\n"
            "필터, 정렬, 프로젝션 입력 — 또는 쿼리 실행을 탭하여 전체 보기. "
            "결과는 포맷된 키-값 표시로 즉시 나타남.\n\n"
            "문서 편집\n"
            "문서 보기, 편집, 복제 또는 삭제. 구문 검증이 포함된 JSON 편집.\n\n"
            "인덱스 보기\n"
            "컬렉션의 모든 인덱스를 한눈에 확인.\n\n"
            "안전하게 연결\n"
            "SCRAM-SHA-256 인증과 TLS 지원으로 연결 프로필 저장. "
            "비밀번호는 시스템 키체인에 안전하게 보관.\n\n"
            "다크 & 라이트 모드\n"
            "시스템 설정을 자동으로 따름.\n\n"
            "macOS, iOS, Android, Linux, Windows에서 네이티브 지원.\n\n"
            "한 번 결제. 모든 기능. 모든 플랫폼."
        ),
        "whats_new": "버그 수정 및 성능 개선.",
        "screenshots": [
            {"caption": "데이터베이스를\n한눈에 탐색"},
            {"caption": "컬렉션을\n쉽게 쿼리"},
            {"caption": "문서를\n즉시 편집"},
            {"caption": "안전하게 연결\n몇 초면 완료"},
            {"caption": "네이티브 속도.\nElectron 없음.\n그냥 MongoDB."},
        ],
        "script": "ko",
    },

    # -----------------------------------------------------------------------
    "it": {
        "name": "Mango — Client MongoDB",
        "subtitle": "Sfoglia. Interroga. Modifica.",
        "keywords": "mongodb,database,nosql,query,documento,collezione,json,gui,client,db,mongo",
        "promotional_text": (
            "Il client MongoDB che funziona e basta. Niente Electron, niente bloat. "
            "Velocita nativa su macOS, iOS, Android, Linux e Windows."
        ),
        "description": (
            "Sfoglia i database, interroga le collezioni e modifica i documenti — "
            "il tutto da un'app nativa veloce che si integra perfettamente su ogni piattaforma.\n\n"
            "Mango e un GUI MongoDB leggero costruito con controlli nativi. "
            "Niente Electron. Niente web view. Un'app nativa vera che si avvia istantaneamente "
            "e usa una frazione della memoria.\n\n"
            "SFOGLIA & ESPLORA\n"
            "Visualizza tutti i tuoi database e collezioni in una barra laterale pulita. "
            "Espandi un database per sfogliare le sue collezioni.\n\n"
            "INTERROGA CON FACILITA\n"
            "Inserisci un filtro, ordinamento o proiezione — o tocca semplicemente Esegui query. "
            "I risultati appaiono istantaneamente in formato chiave-valore.\n\n"
            "MODIFICA DOCUMENTI\n"
            "Visualizza, modifica, duplica o elimina qualsiasi documento. "
            "Modifica JSON completa con validazione della sintassi.\n\n"
            "VISUALIZZA INDICI\n"
            "Tutti gli indici di qualsiasi collezione a colpo d'occhio.\n\n"
            "CONNESSIONE SICURA\n"
            "Salva profili di connessione con autenticazione SCRAM-SHA-256 e supporto TLS. "
            "Password archiviate in modo sicuro nel portachiavi di sistema.\n\n"
            "MODALITA CHIARA & SCURA\n"
            "Segue automaticamente le preferenze di sistema.\n\n"
            "Nativo su macOS, iOS, Android, Linux e Windows.\n\n"
            "Un prezzo. Tutte le funzionalita. Tutte le piattaforme."
        ),
        "whats_new": "Correzioni di bug e miglioramenti delle prestazioni.",
        "screenshots": [
            {"caption": "Sfoglia i tuoi database\na colpo d'occhio"},
            {"caption": "Interroga le collezioni\ncon facilita"},
            {"caption": "Modifica i documenti\nistantaneamente"},
            {"caption": "Connessione sicura\nin pochi secondi"},
            {"caption": "Velocita nativa.\nNiente Electron.\nSolo MongoDB."},
        ],
        "script": "latin",
    },

    # -----------------------------------------------------------------------
    "tr": {
        "name": "Mango — MongoDB Client",
        "subtitle": "Gozat. Sorgula. Duzenle.",
        "keywords": "mongodb,veritabani,nosql,sorgu,belge,koleksiyon,json,gui,istemci,db,mongo",
        "promotional_text": (
            "Sadece calisan MongoDB istemcisi. Electron yok, gereksiz yuk yok. "
            "macOS, iOS, Android, Linux ve Windows'ta dogal hiz."
        ),
        "description": (
            "Veritabanlarini gozat, koleksiyonlari sorgula ve belgeleri duzenle — "
            "her platformda dogal hissettiren hizli, yerel bir uygulamadan.\n\n"
            "Mango, yerel kontrollerle olusturulmus hafif bir MongoDB GUI'sidir. "
            "Electron yok. Web view yok. Aninda baslayan ve cok az bellek kullanan gercek bir yerel uygulama.\n\n"
            "GOZAT & KESIF ET\n"
            "Tum veritabanlari ve koleksiyonlari temiz bir kenar cubugunda gor. "
            "Koleksiyonlari gormek icin veritabanini genislet.\n\n"
            "KOLAYCA SORGULA\n"
            "Bir filtre, siralama veya projeksiyon gir — veya sadece Sorguyu Calistir'a dokun. "
            "Sonuclar aninda anahtar-deger formatinda gorunur.\n\n"
            "BELGELERI DUZENLE\n"
            "Herhangi bir belgeyi goruntule, duzenle, cogalt veya sil. "
            "Sozdizimi dogrulamali tam JSON duzenleme.\n\n"
            "INDEKSLERI GOR\n"
            "Herhangi bir koleksiyonun tum indekslerini bir bakista gor.\n\n"
            "GUVENLI BAGLAN\n"
            "SCRAM-SHA-256 kimlik dogrulama ve TLS destegi ile baglanti profilleri kaydet. "
            "Sifreler sistem anahtarliginda guvenle saklanir.\n\n"
            "ACIK & KOYU MOD\n"
            "Sistem tercihinizi otomatik olarak takip eder.\n\n"
            "macOS, iOS, Android, Linux ve Windows'ta yerel.\n\n"
            "Tek fiyat. Tum ozellikler. Tum platformlar."
        ),
        "whats_new": "Hata duzeltmeleri ve performans iyilestirmeleri.",
        "screenshots": [
            {"caption": "Veritabanlarini\nbir bakista gozat"},
            {"caption": "Koleksiyonlari\nkolayca sorgula"},
            {"caption": "Belgeleri\naninda duzenle"},
            {"caption": "Guvenli baglan\nsaniyeler icinde"},
            {"caption": "Yerel hiz.\nElectron yok.\nSadece MongoDB."},
        ],
        "script": "latin",
    },

    # -----------------------------------------------------------------------
    "th": {
        "name": "Mango — MongoDB Client",
        "subtitle": "เรียกดู สืบค้น แก้ไข",
        "keywords": "mongodb,ฐานข้อมูล,nosql,สืบค้น,เอกสาร,คอลเลกชัน,json,gui,ไคลเอนต์,db",
        "promotional_text": "MongoDB client ที่ใช้งานได้เลย ไม่มี Electron ไม่มีของเกินจำเป็น ความเร็วระดับ native บน macOS, iOS, Android, Linux และ Windows",
        "description": (
            "เรียกดูฐานข้อมูล สืบค้นคอลเลกชัน และแก้ไขเอกสาร — "
            "ทั้งหมดจากแอปเนทีฟที่เร็วและลงตัวบนทุกแพลตฟอร์ม\n\n"
            "Mango เป็น MongoDB GUI ที่เบาและสร้างด้วยคอนโทรลเนทีฟ "
            "ไม่มี Electron ไม่มี Web View แอปเนทีฟจริงที่เปิดได้ทันทีและใช้หน่วยความจำน้อยมาก\n\n"
            "เรียกดูและสำรวจ\n"
            "ดูฐานข้อมูลและคอลเลกชันทั้งหมดในแถบด้านข้างที่เรียบง่าย "
            "ขยายฐานข้อมูลเพื่อดูคอลเลกชัน แตะเพื่อสืบค้น\n\n"
            "สืบค้นอย่างง่ายดาย\n"
            "ป้อนตัวกรอง การเรียงลำดับ หรือโปรเจกชัน — หรือแค่แตะรันสืบค้น "
            "ผลลัพธ์แสดงทันทีในรูปแบบคีย์-ค่า\n\n"
            "แก้ไขเอกสาร\n"
            "ดู แก้ไข ทำซ้ำ หรือลบเอกสารใดก็ได้ แก้ไข JSON เต็มรูปแบบพร้อมตรวจสอบไวยากรณ์\n\n"
            "ดูดัชนี\n"
            "ดูดัชนีทั้งหมดของคอลเลกชันได้ในพริบตา\n\n"
            "เชื่อมต่ออย่างปลอดภัย\n"
            "บันทึกโปรไฟล์การเชื่อมต่อด้วย SCRAM-SHA-256 และรองรับ TLS "
            "รหัสผ่านเก็บอย่างปลอดภัยใน keychain ระบบ\n\n"
            "โหมดสว่างและมืด\n"
            "ตามการตั้งค่าระบบโดยอัตโนมัติ\n\n"
            "เนทีฟบน macOS, iOS, Android, Linux และ Windows\n\n"
            "จ่ายครั้งเดียว ทุกฟีเจอร์ ทุกแพลตฟอร์ม"
        ),
        "whats_new": "แก้ไขข้อผิดพลาดและปรับปรุงประสิทธิภาพ",
        "screenshots": [
            {"caption": "เรียกดูฐานข้อมูล\nได้ในพริบตา"},
            {"caption": "สืบค้นคอลเลกชัน\nอย่างง่ายดาย"},
            {"caption": "แก้ไขเอกสาร\nได้ทันที"},
            {"caption": "เชื่อมต่ออย่างปลอดภัย\nในไม่กี่วินาที"},
            {"caption": "ความเร็ว native\nไม่มี Electron\nแค่ MongoDB"},
        ],
        "script": "th",
    },

    # -----------------------------------------------------------------------
    "id": {
        "name": "Mango — Klien MongoDB",
        "subtitle": "Jelajah. Kueri. Edit.",
        "keywords": "mongodb,database,nosql,kueri,dokumen,koleksi,json,gui,klien,db,mongo",
        "promotional_text": (
            "Klien MongoDB yang langsung berfungsi. Tanpa Electron, tanpa bloat. "
            "Kecepatan native di macOS, iOS, Android, Linux, dan Windows."
        ),
        "description": (
            "Jelajahi database, kueri koleksi, dan edit dokumen — "
            "semuanya dari aplikasi native yang cepat dan nyaman di setiap platform.\n\n"
            "Mango adalah GUI MongoDB ringan yang dibangun dengan kontrol native. "
            "Tanpa Electron. Tanpa web view. Aplikasi native asli yang langsung berjalan "
            "dan hanya menggunakan sedikit memori.\n\n"
            "JELAJAH & EKSPLORASI\n"
            "Lihat semua database dan koleksi di sidebar yang bersih. "
            "Buka database untuk melihat koleksinya. Ketuk untuk kueri.\n\n"
            "KUERI DENGAN MUDAH\n"
            "Masukkan filter, pengurutan, atau proyeksi — atau cukup ketuk Jalankan Kueri. "
            "Hasil muncul instan dalam format kunci-nilai.\n\n"
            "EDIT DOKUMEN\n"
            "Lihat, edit, duplikat, atau hapus dokumen apa pun. "
            "Pengeditan JSON lengkap dengan validasi sintaks.\n\n"
            "LIHAT INDEKS\n"
            "Semua indeks koleksi dalam sekali pandang.\n\n"
            "KONEKSI AMAN\n"
            "Simpan profil koneksi dengan autentikasi SCRAM-SHA-256 dan dukungan TLS. "
            "Kata sandi disimpan dengan aman di keychain sistem.\n\n"
            "MODE TERANG & GELAP\n"
            "Mengikuti preferensi sistem Anda secara otomatis.\n\n"
            "Native di macOS, iOS, Android, Linux, dan Windows.\n\n"
            "Satu harga. Semua fitur. Semua platform."
        ),
        "whats_new": "Perbaikan bug dan peningkatan performa.",
        "screenshots": [
            {"caption": "Jelajahi database\ndalam sekejap"},
            {"caption": "Kueri koleksi\ndengan mudah"},
            {"caption": "Edit dokumen\nseketika"},
            {"caption": "Koneksi aman\ndalam hitungan detik"},
            {"caption": "Kecepatan native.\nTanpa Electron.\nHanya MongoDB."},
        ],
        "script": "latin",
    },

    # -----------------------------------------------------------------------
    "vi": {
        "name": "Mango — MongoDB Client",
        "subtitle": "Duyet. Truy van. Chinh sua.",
        "keywords": "mongodb,co so du lieu,nosql,truy van,tai lieu,bo suu tap,json,gui,khach hang,db,mongo",
        "promotional_text": (
            "MongoDB client hoat dong ngay. Khong Electron, khong phinh to. "
            "Toc do native tren macOS, iOS, Android, Linux va Windows."
        ),
        "description": (
            "Duyet co so du lieu, truy van bo suu tap va chinh sua tai lieu — "
            "tat ca tu mot ung dung native nhanh, tu nhien tren moi nen tang.\n\n"
            "Mango la mot MongoDB GUI nhe, xay dung voi cac dieu khien native. "
            "Khong Electron. Khong web view. Mot ung dung native that su khoi dong ngay lap tuc "
            "va chi su dung mot phan nho bo nho.\n\n"
            "DUYET & KHAM PHA\n"
            "Xem tat ca co so du lieu va bo suu tap trong thanh ben sach se. "
            "Mo rong co so du lieu de duyet bo suu tap. Cham de truy van.\n\n"
            "TRUY VAN DE DANG\n"
            "Nhap bo loc, sap xep hoac phep chieu — hoac chi can cham Chay truy van. "
            "Ket qua hien thi ngay lap tuc voi dinh dang khoa-gia tri.\n\n"
            "CHINH SUA TAI LIEU\n"
            "Xem, chinh sua, nhan ban hoac xoa bat ky tai lieu nao. "
            "Chinh sua JSON day du voi kiem tra cu phap.\n\n"
            "XEM CHI MUC\n"
            "Xem tat ca chi muc cua bat ky bo suu tap nao trong nhay mat.\n\n"
            "KET NOI AN TOAN\n"
            "Luu ho so ket noi voi xac thuc SCRAM-SHA-256 va ho tro TLS. "
            "Mat khau duoc luu tru an toan trong keychain he thong.\n\n"
            "CHE DO SANG & TOI\n"
            "Tu dong theo tuy chon he thong cua ban.\n\n"
            "Native tren macOS, iOS, Android, Linux va Windows.\n\n"
            "Mot muc gia. Tat ca tinh nang. Tat ca nen tang."
        ),
        "whats_new": "Sua loi va cai thien hieu suat.",
        "screenshots": [
            {"caption": "Duyet co so du lieu\ntrong nhay mat"},
            {"caption": "Truy van bo suu tap\nde dang"},
            {"caption": "Chinh sua tai lieu\nngay lap tuc"},
            {"caption": "Ket noi an toan\ntrong vai giay"},
            {"caption": "Toc do native.\nKhong Electron.\nChi MongoDB."},
        ],
        "script": "latin",
    },
}
