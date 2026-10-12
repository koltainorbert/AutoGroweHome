#!/usr/bin/env python3
"""
Minimal gettext tools for the plugin (no external dependencies).

  bin/po-tools.py compile [file.po ...]   .po -> .mo (default: every languages/*.po)
  bin/po-tools.py check   [file.po ...]   counts entries, reports untranslated ones and
                                          placeholder mismatches (exit 1 on any problem)

The .mo writer produces the standard GNU format that WordPress reads (MO class):
keys are msgctxt + EOT + msgid (+ NUL + msgid_plural), plural translations are NUL-joined.
"""
import ast
import glob
import os
import re
import struct
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _unquote(s):
    return ast.literal_eval('"' + s + '"') if s else ''


def parse_po(path):
    """Return a list of entries: dict(ctx, id, plural, strs{n: str}, fuzzy, comments)."""
    entries = []
    cur = None
    last = None

    def new_entry():
        return {'ctx': None, 'id': None, 'plural': None, 'strs': {}, 'fuzzy': False, 'comments': []}

    def done():
        if cur is not None and cur['id'] is not None:
            entries.append(cur)

    with open(path, encoding='utf-8') as fh:
        for raw in fh:
            line = raw.rstrip('\n')
            if not line.strip():
                done()
                cur, last = None, None
                continue
            starts_new = line.startswith('#') or re.match(r'^(msgctxt|msgid)\s', line)
            if starts_new and cur is not None and cur['strs']:
                done()
                cur, last = None, None
            if cur is None:
                cur = new_entry()
            if line.startswith('#'):
                cur['comments'].append(line)
                if line.startswith('#,') and 'fuzzy' in line:
                    cur['fuzzy'] = True
                continue
            m = re.match(r'^(msgctxt|msgid_plural|msgid|msgstr(?:\[(\d+)\])?)\s+"(.*)"$', line)
            if m:
                key, idx, val = m.group(1), m.group(2), _unquote(m.group(3))
                if key == 'msgctxt':
                    cur['ctx'] = val
                    last = 'ctx'
                elif key == 'msgid':
                    cur['id'] = val
                    last = 'id'
                elif key == 'msgid_plural':
                    cur['plural'] = val
                    last = 'plural'
                else:
                    n = int(idx) if idx is not None else 0
                    cur['strs'][n] = val
                    last = n
                continue
            m = re.match(r'^"(.*)"$', line)
            if m and last is not None:
                val = _unquote(m.group(1))
                if isinstance(last, int):
                    cur['strs'][last] += val
                else:
                    cur[last] += val
                continue
            raise ValueError('%s: cannot parse line: %r' % (path, line))
    done()
    return entries


def write_mo(entries, path):
    pairs = {}
    for e in entries:
        if e['fuzzy'] and e['id'] != '':
            continue
        strs = [e['strs'][k] for k in sorted(e['strs'])]
        if not any(strs):
            continue
        key = e['id'] if e['plural'] is None else e['id'] + '\0' + e['plural']
        if e['ctx'] is not None:
            key = e['ctx'] + '\x04' + key
        pairs[key.encode('utf-8')] = '\0'.join(strs).encode('utf-8')
    keys = sorted(pairs)
    n = len(keys)
    o_tab = 7 * 4
    t_tab = o_tab + n * 8
    data_start = t_tab + n * 8
    ids, strs, o_ent, t_ent = b'', b'', [], []
    for k in keys:
        o_ent.append((len(k), data_start + len(ids)))
        ids += k + b'\0'
    s_start = data_start + len(ids)
    for k in keys:
        v = pairs[k]
        t_ent.append((len(v), s_start + len(strs)))
        strs += v + b'\0'
    out = struct.pack('<7I', 0x950412de, 0, n, o_tab, t_tab, 0, data_start)
    for ln, off in o_ent:
        out += struct.pack('<2I', ln, off)
    for ln, off in t_ent:
        out += struct.pack('<2I', ln, off)
    out += ids + strs
    with open(path, 'wb') as fh:
        fh.write(out)
    return n


def read_mo(path):
    data = open(path, 'rb').read()
    magic = struct.unpack('<I', data[:4])[0]
    fmt = '<' if magic == 0x950412de else '>'
    _, _, n, o_tab, t_tab = struct.unpack(fmt + '5I', data[:20])
    out = {}
    for i in range(n):
        ol, oo = struct.unpack(fmt + '2I', data[o_tab + i * 8:o_tab + i * 8 + 8])
        tl, to = struct.unpack(fmt + '2I', data[t_tab + i * 8:t_tab + i * 8 + 8])
        out[data[oo:oo + ol]] = data[to:to + tl]
    return out


PH = re.compile(r'%(?:\d+\$)?[sd]')


def check(entries, path):
    problems = 0
    total = 0
    for e in entries:
        if e['id'] == '':
            continue
        total += 1
        strs = [e['strs'][k] for k in sorted(e['strs'])]
        if not all(strs):
            problems += 1
            print('%s: untranslated: %r' % (os.path.basename(path), e['id'][:70]))
            continue
        want = sorted(PH.findall(e['id']))
        for s in strs:
            if e['plural'] is None and sorted(PH.findall(s)) != want:
                problems += 1
                print('%s: placeholder mismatch: %r -> %r' % (os.path.basename(path), e['id'][:60], s[:60]))
    return total, problems


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ('compile', 'check'):
        print(__doc__)
        return 2
    files = sys.argv[2:] or sorted(glob.glob(os.path.join(ROOT, 'languages', '*.po')))
    bad = 0
    for po in files:
        entries = parse_po(po)
        if sys.argv[1] == 'compile':
            n = write_mo(entries, po[:-3] + '.mo')
            print('%s: %d entries' % (os.path.basename(po[:-3] + '.mo'), n))
        else:
            total, problems = check(entries, po)
            bad += problems
            print('%s: %d strings, %d problems' % (os.path.basename(po), total, problems))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
