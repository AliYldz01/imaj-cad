# Komut grupları: "#cmds button[title='X']" tıklanmadan önce ilgili grubu aç
import re
from playwright.sync_api import Page
_re = re.compile(r"#cmds button(?:\[title='([^']+)'\]|:has-text\('([^']+)'\))")
def _wrap(name):
    orig = getattr(Page, name)
    def f(self, selector, *a, **k):
        m = _re.search(selector) if isinstance(selector, str) else None
        if m:
            try: self.evaluate("t=>window.__app && window.__app.showCmd && window.__app.showCmd(t)", m.group(1) or m.group(2))
            except Exception: pass
        return orig(self, selector, *a, **k)
    setattr(Page, name, f)
for n in ("click", "tap"): _wrap(n)
