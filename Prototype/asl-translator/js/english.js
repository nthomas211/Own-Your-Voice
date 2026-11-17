// Turns a stream of recognized ASL glosses (e.g. ME NAME WHAT) into readable English.
// ASL grammar differs from English (topic-comment order, no "to be", no articles), so a
// full translation needs a language model; these lightweight rules handle the most
// common patterns so the output reads naturally for everyday phrases.

const WORD_MAP = {
  ME: "I", I: "I", MY: "my", MINE: "mine", YOU: "you", YOUR: "your",
  "THANK-YOU": "thank you", THANKYOU: "thank you", "THANK YOU": "thank you",
  "NICE-MEET-YOU": "nice to meet you", "HOW-ARE-YOU": "how are you",
  "I-LOVE-YOU": "I love you", ILY: "I love you",
  BATHROOM: "the bathroom", RESTROOM: "the restroom",
};

const QUESTION_WORDS = new Set(["WHAT", "WHERE", "WHO", "WHEN", "WHY", "HOW", "WHICH", "HOW-ARE-YOU"]);
const ADJ_AFTER_PRONOUN = new Set([
  "HAPPY", "SAD", "TIRED", "HUNGRY", "THIRSTY", "SICK", "FINE", "GOOD", "BAD", "OK", "READY",
  "DEAF", "HEARING", "HOT", "COLD", "SORRY", "BUSY", "EXCITED", "SCARED", "ANGRY", "LATE",
]);
const WANT_VERBS = new Set(["WANT", "NEED", "LIKE", "LOVE", "TRY", "HAVE"]);
const VERBS = new Set(["EAT", "DRINK", "GO", "SLEEP", "LEARN", "HELP", "PLAY", "WORK", "SIGN", "MEET", "READ", "WATCH", "SEE", "TALK", "STUDY", "BUY", "PAY", "LEAVE"]);
const BE = { I: "am", you: "are", he: "is", she: "is", we: "are", they: "are", it: "is" };

function wordFor(gloss) {
  const g = gloss.toUpperCase().trim();
  if (WORD_MAP[g]) return WORD_MAP[g];
  return g.toLowerCase().replace(/-/g, " ");
}

/** Convert one sentence's worth of glosses into an English sentence. */
export function glossToSentence(glosses) {
  if (!glosses.length) return "";
  const up = glosses.map((g) => g.toUpperCase().trim());
  let words = up.map(wordFor);
  const isQuestion = up.some((g) => QUESTION_WORDS.has(g));

  // Insert "to be" (ASL omits it): "ME HAPPY" -> "I am happy"
  for (let i = 0; i < up.length - 1; i++) {
    if (BE[words[i]] && ADJ_AFTER_PRONOUN.has(up[i + 1])) {
      words.splice(i + 1, 0, BE[words[i]]);
      up.splice(i + 1, 0, "");
      break;
    }
  }

  // "ME WANT EAT" -> "I want to eat"
  for (let i = up.length - 2; i >= 0; i--) {
    if (WANT_VERBS.has(up[i]) && VERBS.has(up[i + 1])) {
      words.splice(i + 1, 0, "to");
      up.splice(i + 1, 0, "");
    }
  }

  // "ME NAME J-O-E" -> "My name is Joe";  "YOUR NAME WHAT" -> "What is your name"
  if (up[0] === "ME" && up[1] === "NAME") words = ["my", "name", "is", ...words.slice(2)];
  if ((up[0] === "YOU" || up[0] === "YOUR") && up[1] === "NAME") {
    const rest = words.slice(2).filter((w) => w !== "what");
    words = up.includes("WHAT") ? ["what", "is", "your", "name", ...rest] : ["your", "name", ...rest];
  }

  // Move a trailing wh-word to the front: "BATHROOM WHERE" -> "where the bathroom"
  if (isQuestion && QUESTION_WORDS.has(up[up.length - 1]) && words[0] !== "what" && up.length > 1) {
    const q = words.pop();
    words.unshift(q);
    // "where the bathroom" -> "where is the bathroom"
    if (words.length >= 2 && !["is", "are", "am", "do"].includes(words[1])) words.splice(1, 0, "is");
  }

  // Drop immediate duplicates caused by a held sign being read twice.
  words = words.filter((w, i) => i === 0 || w !== words[i - 1]);

  let s = words.join(" ");
  s = s.charAt(0).toUpperCase() + s.slice(1);
  s = s.replace(/\bi\b/g, "I");
  return s + (isQuestion ? "?" : ".");
}

/** Build the full English text from a list of sentences (each a list of glosses). */
export function toEnglish(sentences) {
  return sentences.filter((s) => s.length).map(glossToSentence).join(" ");
}
