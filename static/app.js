document.addEventListener('DOMContentLoaded', () => {

    // ----------- Globaller -----------
    window.globalName = ""; // herkesin ulaşabileceği yer

    // ----------- Veritabanı ve Ayarlar -----------
    const DATABASE = {
        dijital: {
            color: 0x0055ff, cls: 'filter-blue',
            msg: "Tespit: Siber zorbalık (dijital). Lütfen bir yetişkine veya güvenilir kişiye göster.",
            keywords: [
                "mesaj", "yazdı", "paylaştı", "internet", "site", "hesap", "video", "ifşa",
                "grup", "dm", "wp", "whatsapp", "instagram", "facebook", "tiktok", "snap",
                "fotoğraf", "gönderi", "etiketledi", "hack", "şantaj", "hesap kapatma", "bilgi sızdırma",
                "paylaşmış", "sızdırdı", "screenshot", "ss"
            ]
        },
        fiziksel: {
            color: 0xffcc00, cls: 'filter-yellow',
            msg: "Tespit: Fiziksel zorbalık. Güvende değilsen hemen bir yetişkine haber ver.",
            keywords: [
                "vurdu", "itti", "dövdü", "tekme", "tokat", "acı", "yaralandı", "kırdı",
                "saçını çekti", "yumruk", "çelme", "yaraladılar", "saldırdı", "saldırı", "itildi", "yumrukladı",
                "öldüreceğim", "öldüreceğim"
            ]
        },
        sozel: {
            color: 0xff0000, cls: 'filter-red',
            msg: "Tespit: Sözel zorbalık. Kimseye hakaret edilmesine izin verme; bir yetişkinle paylaş.",
            keywords: [
                "küfür", "hakaret", "alay", "dalga", "lakap", "bağırdı", "aşağıladı", "rezil",
                "salak", "aptal", "çirkin", "dışladı", "yuh", "dalga geçti", "aptalca", "geri zekalı"
            ]
        }
    };

    const NEGATIONS = ["değil", "yok", "etmedi", "etmiyor", "ama", "fakat", "şaka", "değildi"];
    const INSULTS = ["salak","aptal","gerizekalı","orospu","mal"];
    const THREATS = ["öldür","vuracağım","yakarım","döveceğim","keserim","boğacağım"];
    const NEGATIVE_WORDS = ["nefret","pis","iğrenç","berbat","utanç"];
    const INTENSIFIERS = ["çok","hep","sürekli","kesinlikle","fazla","tamamen"];
    const URL_PATTERNS = ["http", "www.", ".com", ".net", "instagram.com", "tiktok.com", "facebook.com"];

    // ----------- Yardımcı Fonksiyonlar -----------
    function normalizeText(s) {
        return s.toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
                .replace(/\s+/g, ' ').trim();
    }

    function tokenize(s) { return s ? s.split(' ').filter(Boolean) : []; }
    function hasNegationNear(normalTokens, index, windowSize = 3) {
        const start = Math.max(0, index - windowSize);
        for (let i = start; i < index; i++) if (NEGATIONS.includes(normalTokens[i])) return true;
        return false;
    }

    function editDistance(a, b) {
        const m = a.length, n = b.length;
        const dp = Array.from({length: m+1}, () => Array(n+1).fill(0));
        for (let i=0;i<=m;i++) dp[i][0]=i;
        for (let j=0;j<=n;j++) dp[0][j]=j;
        for (let i=1;i<=m;i++) {
            for (let j=1;j<=n;j++) {
                const cost = a[i-1] === b[j-1] ? 0 : 1;
                dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+cost);
            }
        }
        return dp[m][n];
    }

    function ngrams(tokens, maxN=3) {
        const out = [];
        for (let n = 1; n <= Math.min(maxN, tokens.length); n++) {
            for (let i = 0; i + n <= tokens.length; i++) out.push(tokens.slice(i,i+n).join(' '));
        }
        return out;
    }

    function repeatedLetterScore(s) { const matches = s.match(/([a-zçğıöşü])\1{2,}/gi); return matches ? matches.length : 0; }
    function allCapsScore(tokens) {
        if (!tokens || tokens.length === 0) return 0;
        let caps = 0;
        for (let t of tokens) if (t.length >= 2 && t === t.toUpperCase() && /[A-ZİĞÜŞÖÇ]/.test(t)) caps++;
        return caps / tokens.length;
    }

    // ----------- Giriş (Login) -----------
    window.login = function() {
        const input = document.getElementById('userName');
        const loginScreen = document.getElementById('loginScreen');
        const mainApp = document.getElementById('mainApp');
        const adviceArea = document.getElementById('adviceArea');

        if (!input) return;
        const value = input.value.trim();
        if (value === "") {
            input.classList.add('input-warning');
            setTimeout(()=> input.classList.remove('input-warning'), 900);
            return;
        }
        window.globalName = value;
        if (loginScreen) loginScreen.style.display = 'none';
        if (mainApp) mainApp.style.display = 'block';
        if (adviceArea) adviceArea.innerText = `Merhaba ${window.globalName}, Capy seni dinliyor.`;
    };

    const nameInput = document.getElementById('userName');
    if (nameInput) nameInput.addEventListener('keypress', (e) => { if(e.key==='Enter') window.login(); });

    // ----------- Analiz fonksiyonu -----------
    async function analyze() {
        const userInputField = document.getElementById('userInput');
        const adviceArea = document.getElementById('adviceArea');
        const capyImgEl = document.getElementById('capyImage');

        if (!userInputField || !adviceArea) return;

        const rawTextOrig = userInputField.value.trim();
        if (!rawTextOrig) return;

        const normalized = normalizeText(rawTextOrig);
        const tokens = tokenize(normalized);
        const grams = ngrams(tokens, 3);

        const scores = {};
        const detailMatches = {};
        for (let cat in DATABASE) { scores[cat] = 0; detailMatches[cat] = []; }

        for (let cat in DATABASE) {
            for (let kw of DATABASE[cat].keywords) {
                const kwNorm = normalizeText(kw);
                if (kwNorm.includes(' ')) {
                    if (normalized.includes(kwNorm)) { scores[cat] += 4; detailMatches[cat].push({type:'phrase', kw:kwNorm}); }
                } else {
                    for (let g of grams) if (g === kwNorm) { scores[cat]+=2.2; detailMatches[cat].push({type:'ngram', kw:kwNorm}); }
                }
            }
        }

        for (let cat in DATABASE) {
            for (let kw of DATABASE[cat].keywords) {
                const k = normalizeText(kw);
                for (let i = 0; i < tokens.length; i++) if (tokens[i]===k && !hasNegationNear(tokens,i)) { scores[cat]+=1.8; detailMatches[cat].push({type:'token', kw:k}); }
            }
        }

        for (let cat in DATABASE) {
            for (let kw of DATABASE[cat].keywords) {
                const k = normalizeText(kw);
                for (let t of tokens) {
                    const dist = editDistance(t,k);
                    if(dist===0) continue;
                    if(Math.max(t.length,k.length)<=10){
                        if(dist<=1){scores[cat]+=1.2; detailMatches[cat].push({type:'fuzzy1', kw:k, token:t});}
                        else if(dist<=2){scores[cat]+=0.6; detailMatches[cat].push({type:'fuzzy2', kw:k, token:t});}
                    } else { if(t.includes(k)||k.includes(t)){scores[cat]+=0.5; detailMatches[cat].push({type:'substr', kw:k, token:t});} }
                }
            }
        }

        for (let t of tokens) {
            for (let th of THREATS) if(t.includes(th)){scores['fiziksel']+=6; detailMatches['fiziksel'].push({type:'threat', kw:th});}
            for (let ins of INSULTS) if(t.includes(ins)){scores['sozel']+=2.5; detailMatches['sozel'].push({type:'insult', kw:ins});}
            for (let nw of NEGATIVE_WORDS) if(t.includes(nw)){scores['sozel']+=0.9;}
        }

        for(let p of URL_PATTERNS) if(normalized.includes(p)){scores['dijital']+=3.5; detailMatches['dijital'].push({type:'url', kw:p});}

        const exclamations = (rawTextOrig.match(/!/g) || []).length;
        const capsRatio = allCapsScore(rawTextOrig.split(/\s+/));
        const repScore = repeatedLetterScore(rawTextOrig);

        if(exclamations>0) scores['sozel']*=(1+Math.min(0.35,0.12*exclamations));
        if(capsRatio>0.3) scores['sozel']*=(1+Math.min(0.5,capsRatio*1.2));
        if(repScore>0) scores['sozel']+=repScore*0.6;

        for(let w of INTENSIFIERS) if(normalized.includes(w)) for(let cat in scores) scores[cat]*=1.08;

        const entries = Object.entries(scores).sort((a,b)=>b[1]-a[1]);
        const [bestCat,bestScore]=entries[0];
        const secondScore = entries[1]?entries[1][1]:0;
        const totalPositive = Object.values(scores).reduce((s,x)=>s+Math.max(0,x),0);
        let rawConfidence = totalPositive<=0.001?50:Math.min(99.9,(bestScore/totalPositive)*110);
        const threatBoost = detailMatches['fiziksel'].some(m=>m.type==='threat')?10:0;
        const finalConfidence = Math.min(99.9,Math.round((rawConfidence+threatBoost)*10)/10);

        const info = DATABASE[bestCat];
        if(capyImgEl) capyImgEl.className='footer-img '+info.cls;

        let note = `Tespit: ${bestCat} zorbalık. Güven: ${finalConfidence}%`;
        if((bestScore-secondScore)<=0.8) note += " — bazı karışık işaretler var ama en olası sonuç bu.";

        adviceArea.innerText = `${info.msg} (${note})`;

        const payload = { name: window.globalName||"", text: rawTextOrig, detected: bestCat, scores: scores, confidence: finalConfidence, matches: detailMatches };
        fetch('/log',{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)}).catch(()=>console.log("Log gönderilemedi."));

        userInputField.value="";
        userInputField.focus();
    }

    const startBtn = document.getElementById('startBtn');
    if(startBtn) startBtn.addEventListener('click', window.login);

    const sendBtn = document.getElementById('sendBtn');
    if(sendBtn) sendBtn.addEventListener('click', analyze);

    const userInput = document.getElementById('userInput');
    if(userInput) userInput.addEventListener('keypress', (e)=>{if(e.key==='Enter') analyze();});

});
