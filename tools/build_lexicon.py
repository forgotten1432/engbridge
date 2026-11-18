#!/usr/bin/env python3
"""Builds content/lexicon/*.json from open sources.

Sources (downloaded into tools/sources/ on first run):
  - CEFR-J Vocabulary Profile 1.5 (A1-B2)  – free for research/commercial use with citation (Tono Lab, TUFS)
  - Octanove Vocabulary Profile C1/C2 1.0   – CC BY-SA 4.0 (Octanove Labs)
  - Openjam words_en.sql (WordNet 3.1 senses: English definitions + examples) – MIT / WordNet licence
  - CMU Pronouncing Dictionary (via the `cmudict` pip package) – BSD-style; converted to US IPA
Usage:  pip install cmudict && python3 tools/build_lexicon.py
"""
import csv, json, os, re, sys, urllib.request
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'sources')
OUT = os.path.join(ROOT, 'content', 'lexicon')
URLS = {
    'cefrj.csv': 'https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/cefrj-vocabulary-profile-1.5.csv',
    'octanove.csv': 'https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/octanove-vocabulary-profile-c1c2-1.0.csv',
    'openjam_words_en.sql': 'https://raw.githubusercontent.com/amirj4m/openjam/main/data/sql/words_en.sql',
}
LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

def fetch():
    os.makedirs(SRC, exist_ok=True)
    for name, url in URLS.items():
        p = os.path.join(SRC, name)
        if not os.path.exists(p):
            print('download', url); urllib.request.urlretrieve(url, p)

# ---- ARPAbet -> IPA (General American) ----
V = {'AA': 'ɑ', 'AE': 'æ', 'AH': 'ʌ', 'AO': 'ɔ', 'AW': 'aʊ', 'AY': 'aɪ', 'EH': 'ɛ', 'ER': 'ɝ', 'EY': 'eɪ',
     'IH': 'ɪ', 'IY': 'i', 'OW': 'oʊ', 'OY': 'ɔɪ', 'UH': 'ʊ', 'UW': 'u'}
C = {'B': 'b', 'CH': 'tʃ', 'D': 'd', 'DH': 'ð', 'F': 'f', 'G': 'ɡ', 'HH': 'h', 'JH': 'dʒ', 'K': 'k', 'L': 'l', 'M': 'm',
     'N': 'n', 'NG': 'ŋ', 'P': 'p', 'R': 'r', 'S': 's', 'SH': 'ʃ', 'T': 't', 'TH': 'θ', 'V': 'v', 'W': 'w', 'Y': 'j',
     'Z': 'z', 'ZH': 'ʒ'}
ONSETS = {'', 'b', 'd', 'f', 'ɡ', 'h', 'dʒ', 'k', 'l', 'm', 'n', 'p', 'r', 's', 'ʃ', 't', 'tʃ', 'θ', 'ð', 'v', 'w', 'j', 'z', 'ʒ',
          'bl', 'br', 'dr', 'fl', 'fr', 'ɡl', 'ɡr', 'kl', 'kr', 'kw', 'pl', 'pr', 'sk', 'skr', 'skw', 'sl', 'sm', 'sn', 'sp', 'spl', 'spr', 'st', 'str', 'sw', 'tr', 'tw', 'θr', 'ʃr', 'dw', 'ɡw', 'fj', 'kj', 'mj', 'pj', 'bj', 'hj', 'vj'}

def to_ipa(phones):
    segs = []  # (ipa, is_vowel, stress)
    for ph in phones:
        m = re.match(r'([A-Z]+)(\d)?', ph); base, st = m.group(1), m.group(2)
        if base in V:
            sym = V[base]
            if st == '0':
                sym = {'ʌ': 'ə', 'ɝ': 'ɚ'}.get(sym, sym)
            segs.append([sym, True, st])
        else:
            segs.append([C.get(base, base.lower()), False, None])
    out = []
    for i, (sym, vow, st) in enumerate(segs):
        if vow and st in ('1', '2'):
            # move stress mark before the longest legal onset
            j = len(out); onset = ''
            while j > 0 and not out[j - 1][1] and (out[j - 1][0] + onset) in ONSETS:
                onset = out[j - 1][0] + onset; j -= 1
            out.insert(j, ['ˈ' if st == '1' else 'ˌ', False])
        out.append([sym, vow])
    if sum(1 for x in out if x[1]) == 1:
        out = [x for x in out if x[0] not in ('ˈ', 'ˌ')]
    s = ''.join(x[0] for x in out)
    return '/' + s.lstrip('ˌ') + '/'

def main():
    fetch()
    import cmudict
    cmu = cmudict.dict()
    entries = {}
    def add(word, pos, level):
        w = word.strip()
        if not w: return
        key = w.lower()
        e = entries.setdefault(key, {'w': w, 'l': level, 'p': []})
        if LEVELS.index(level) < LEVELS.index(e['l']): e['l'] = level
        if pos and pos not in e['p']: e['p'].append(pos)
    for row in csv.DictReader(open(os.path.join(SRC, 'cefrj.csv'), encoding='utf-8')):
        lv = row['CEFR'].strip().upper()[:2]
        if lv not in LEVELS: continue
        add(row['headword'].split('/')[0], row['pos'].strip(), lv)
    for row in csv.DictReader(open(os.path.join(SRC, 'octanove.csv'), encoding='utf-8')):
        lv = row['CEFR'].strip().upper()[:2]
        if lv not in LEVELS: continue
        if row['headword'].lower() in entries and LEVELS.index(entries[row['headword'].lower()]['l']) < 4:
            continue  # CEFR-J already places it lower
        add(row['headword'].split('/')[0], row['pos'].strip(), lv)
        entries[row['headword'].split('/')[0].strip().lower()]['src'] = 'oct'

    # WordNet senses from Openjam
    sql = open(os.path.join(SRC, 'openjam_words_en.sql'), encoding='utf-8').read()
    tup = re.compile(r"\('((?:[^']|'')*)'(?:,\s*)?")
    tok = re.compile(r"'((?:[^']|'')*)'|(NULL)|(-?\d+)")
    def rows(table):
        i = sql.find(f'INSERT INTO {table}')
        while i >= 0:
            j = sql.find(';\n', i)
            block = sql[sql.find('VALUES', i) + 6:j]
            for m in re.finditer(r"^\s*\((.*)\),?\s*$", block, re.M):
                yield [None if b else (a.replace("''", "'") if c == '' else c) for a, b, c in tok.findall(m.group(1))]
            i = sql.find(f'INSERT INTO {table}', j)
    words = {}
    for r in rows('words'):
        words[r[0]] = r[1]
    senses = defaultdict(list)
    for r in rows('word_senses'):
        _, wid, pos, order, d, ex = r[:6]
        if wid in words: senses[words[wid]].append((pos, int(order), d, ex))
    with_def = 0
    for key, e in entries.items():
        want = [x.split()[0].lower() for x in e['p']]
        s = sorted(senses.get(key, []), key=lambda x: (0 if x[0] in want else 1, want.index(x[0]) if x[0] in want else 9, x[1]))
        if s:
            picked, seen = [], set()
            for pos, order, d, ex in s:
                if pos in seen and len(picked) >= 1: continue
                seen.add(pos); picked.append([pos, d, ex or ''])
                if len(picked) == 2: break
            e['d'] = picked; with_def += 1
        prons = cmu.get(key) or cmu.get(key.replace('-', ''))
        if prons: e['i'] = to_ipa(prons[0])
    os.makedirs(OUT, exist_ok=True)
    by = defaultdict(list)
    for e in entries.values(): by[e['l']].append(e)
    meta = {'levels': {}, 'sources': [
        {'name': 'CEFR-J Vocabulary Profile 1.5', 'by': 'Yukio Tono, Tokyo University of Foreign Studies', 'url': 'https://github.com/openlanguageprofiles/olp-en-cefrj', 'license': 'Free for research and commercial use with citation', 'used': 'A1–B2 levels and parts of speech'},
        {'name': 'Octanove Vocabulary Profile C1/C2 1.0', 'by': 'Octanove Labs', 'url': 'https://github.com/openlanguageprofiles/olp-en-cefrj', 'license': 'CC BY-SA 4.0', 'used': 'C1–C2 levels'},
        {'name': 'Princeton WordNet 3.1 (via Openjam)', 'by': 'Princeton University; Openjam (amirj4m)', 'url': 'https://github.com/amirj4m/openjam', 'license': 'WordNet License / MIT', 'used': 'English definitions and examples'},
        {'name': 'CMU Pronouncing Dictionary', 'by': 'Carnegie Mellon University', 'url': 'http://www.speech.cs.cmu.edu/cgi-bin/cmudict', 'license': 'BSD-style', 'used': 'US pronunciation, converted to IPA'},
    ]}
    for lv in LEVELS:
        items = sorted(by[lv], key=lambda e: e['w'].lower())
        for e in items: e.pop('l', None); e.pop('src', None)
        json.dump(items, open(os.path.join(OUT, f'{lv}.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
        meta['levels'][lv] = len(items)
    json.dump(meta, open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('entries', len(entries), 'with definitions', with_def, meta['levels'])

if __name__ == '__main__':
    main()
