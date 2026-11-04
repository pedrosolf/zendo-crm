/**
 * Clasificador de reclamos: copia del de denuncias-next (src/lib/clasificador.ts), que a
 * su vez replica el ClasificadorService del proyecto Laravel. Mismo algoritmo a proposito:
 * el agente sugiere las mismas categorias que el wizard web para el mismo texto.
 * 100% local, sin claves externas.
 */

export type Sugerencia = {
    tipo_id: number;
    tipo: string;
    problema_id: number;
    problema: string;
    score: number;
};

type ProblemaClasificable = {
    id: number;
    nombre: string;
    tipo_id: number;
    tipo_nombre: string;
    sinonimos: string[];
};

const TOP_N = 8;
const STOPWORDS = new Set([
    'de', 'la', 'el', 'los', 'las', 'en', 'y', 'a', 'un', 'una', 'que', 'con',
    'por', 'para', 'del',
]);

const MAPA_ACENTOS: Record<string, string> = {
    á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u',
    à: 'a', è: 'e', ì: 'i', ò: 'o', ù: 'u',
    ñ: 'n', ü: 'u', ç: 'c',
};

function quitarAcentos(texto: string): string {
    return texto.replace(/[áéíóúàèìòùñüç]/g, (c) => MAPA_ACENTOS[c] ?? c);
}

function normalizar(texto: string): string {
    let t = texto.toLowerCase().trim();
    t = quitarAcentos(t);
    t = t.replace(/[^a-z0-9\s]/g, ' ');
    t = t.replace(/\s+/g, ' ');
    return t.trim();
}

function tokenizar(texto: string): string[] {
    return texto
        .split(' ')
        .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/** Distancia de Levenshtein clásica (solo ASCII, ya normalizado). */
function levenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;

    const fila = new Array(n + 1);
    for (let j = 0; j <= n; j++) fila[j] = j;

    for (let i = 1; i <= m; i++) {
        let anterior = fila[0];
        fila[0] = i;
        for (let j = 1; j <= n; j++) {
            const temp = fila[j];
            fila[j] = Math.min(
                fila[j] + 1,
                fila[j - 1] + 1,
                anterior + (a[i - 1] === b[j - 1] ? 0 : 1),
            );
            anterior = temp;
        }
    }
    return fila[n];
}

/** % de similitud tipo similar_text de PHP (longest common substring recursivo). */
function similarText(a: string, b: string): number {
    if (a.length === 0 || b.length === 0) return 0;

    let max = 0, posA = 0, posB = 0;
    for (let i = 0; i < a.length; i++) {
        for (let j = 0; j < b.length; j++) {
            let k = 0;
            while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k++;
            if (k > max) {
                max = k;
                posA = i;
                posB = j;
            }
        }
    }
    if (max === 0) return 0;

    let total = max;
    if (posA > 0 && posB > 0) {
        total += similarTextCount(a.slice(0, posA), b.slice(0, posB));
    }
    if (posA + max < a.length && posB + max < b.length) {
        total += similarTextCount(a.slice(posA + max), b.slice(posB + max));
    }
    return (total * 2) / (a.length + b.length);
}

function similarTextCount(a: string, b: string): number {
    return similarText(a, b) * (a.length + b.length) / 2;
}

function simTokens(tc: string, tp: string): number {
    if (tc === tp || tp.includes(tc) || tc.includes(tp)) return 1.0;

    if (Math.abs(tc.length - tp.length) <= 2 && Math.min(tc.length, tp.length) >= 4) {
        const dist = levenshtein(tc, tp);
        if (dist <= 1) return 0.8;
        if (dist <= 2 && Math.min(tc.length, tp.length) >= 7) return 0.65;
    }
    return 0;
}

function puntuar(
    consulta: string,
    tokensConsulta: string[],
    textoProblema: string,
    tokensProblema: string[],
): number {
    if (tokensConsulta.length === 0 || tokensProblema.length === 0) return 0;

    const scores = tokensConsulta.map((tc) =>
        Math.max(0, ...tokensProblema.map((tp) => simTokens(tc, tp))),
    );
    const tokenScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    if (tokenScore <= 0) return 0;

    const similitud = similarText(consulta, textoProblema);

    return Math.round((tokenScore * 0.95 + similitud * 0.05) * 10000) / 10000;
}

/**
 * Sugiere problemas a partir de texto libre, 100% local (sin claves externas).
 * Mismo algoritmo que app/Services/ClasificadorService.php del proyecto Laravel.
 */
export function sugerir(texto: string, catalogo: ProblemaClasificable[]): Sugerencia[] {
    const consulta = normalizar(texto);
    if (consulta === '') return [];

    const tokensConsulta = tokenizar(consulta);

    const resultados = catalogo.map((p) => {
        const textoProblemaCrudo = [p.nombre, p.tipo_nombre, ...p.sinonimos].join(' ');
        const normalizado = normalizar(textoProblemaCrudo);
        const tokensProblema = tokenizar(normalizado);
        const score = puntuar(consulta, tokensConsulta, normalizado, tokensProblema);

        return {
            tipo_id: p.tipo_id,
            tipo: p.tipo_nombre,
            problema_id: p.id,
            problema: p.nombre,
            score,
        };
    });

    return resultados
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, TOP_N);
}
