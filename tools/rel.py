# Sürüm kaydı yardımcısı (depo kökünden çalıştır):
# python3 tools/rel.py <sürüm 0.57> <sw no 69> "<CLAUDE.md §4 satırı>" "<YOL_HARITASI tablo satırı>" "<README satırı>" "<§6 test girdisi ya da "">" "<§5 eski metin ya da "">" "<§5 yeni metin>"
# sw.js önbellek adını, index.html yardım başlığını, CLAUDE.md §3 sürüm numaralarını, §4 (v0.36 satırının üstüne), §6 (kr1'in önüne), §5 değişimini, YOL_HARITASI ve README'yi günceller.
import sys
def ed(p,a,b):
    s=open(p).read(); assert a in s,(p,a); s=s.replace(a,b,1); open(p,'w').write(s)
v, sw, cl4, yol, readme, tests, nxt_old, nxt_new = sys.argv[1:9]
prev_sw=str(int(sw)-1)
ed('public/sw.js',f'imajcad-v{prev_sw}',f'imajcad-v{sw}')
import re
s=open('index.html').read(); s=re.sub(r'İmaj CAD — v[0-9.]+', f'İmaj CAD — v{v}', s, count=1); open('index.html','w').write(s)
c='CLAUDE.md'; s=open(c).read()
s=re.sub(r'\(şu an `imajcad-v\d+`\)', f'(şu an `imajcad-v{sw}`)', s, count=1)
s=re.sub(r'\(şu an \*\*v[0-9.]+\*\*\)', f'(şu an **v{v}**)', s, count=1)
s=s.replace('- **v0.36:**', cl4+'\n- **v0.36:**',1) if '- **v0.36:**' in s else s
if tests: s=s.replace('`kr1` (kalıcı', tests+', `kr1` (kalıcı',1)
if nxt_old: 
    assert nxt_old in s, nxt_old; s=s.replace(nxt_old,nxt_new,1)
open(c,'w').write(s)
s=open('docs/YOL_HARITASI.md').read().rstrip()+'\n\n'+yol+'\n'; open('docs/YOL_HARITASI.md','w').write(s)
ed('README.md','- v0.36:', readme+'\n- v0.36:')
