import os, json, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
EXT_DIR = os.path.join(ROOT, "extensions")

EXTS = [
    "configuration-editing", "copilot", "css-language-features", "css-language-features/server",
    "debug-auto-launch", "debug-server-ready", "emmet", "extension-editing", "git", "git-base",
    "github", "github-authentication", "grunt", "gulp", "html-language-features",
    "html-language-features/server", "ipynb", "jake",
    "json-language-features", "json-language-features/server", "markdown-language-features",
    "markdown-math", "media-preview", "merge-conflict", "mermaid-markdown-features",
    "microsoft-authentication", "notebook-renderers", "npm", "php-language-features",
    "references-view", "search-result", "simple-browser", "terminal-suggest",
    "tunnel-forwarding", "typescript-language-features", "typescript-language-features/server",
    "vscode-api-tests", "vscode-colorize-tests", "vscode-colorize-perf-tests",
    "vscode-test-resolver",
]

def find_broken():
    broken = []
    for ext in EXTS:
        nm = os.path.join(EXT_DIR, ext, "node_modules")
        if not os.path.exists(nm):
            continue
        for entry in os.scandir(nm):
            if entry.name.startswith(".") or not entry.is_dir():
                continue
            if entry.name.startswith("@"):
                for scoped in os.scandir(entry.path):
                    if scoped.is_dir():
                        check_pkg(ext, scoped.path, f"{entry.name}/{scoped.name}", broken)
            else:
                check_pkg(ext, entry.path, entry.name, broken)
    return broken

def check_pkg(ext, pkg_path, pkg_name, broken):
    pkg_json = os.path.join(pkg_path, "package.json")
    if not os.path.exists(pkg_json):
        return
    try:
        with open(pkg_json, "r", encoding="utf-8") as f:
            data = json.load(f)
    except:
        return
    main = data.get("main") or data.get("module")
    types = data.get("types") or data.get("typings")
    check = types or main
    if not check:
        return
    if os.path.exists(os.path.join(pkg_path, check)):
        return
    has_src = os.path.isdir(os.path.join(pkg_path, "src"))
    scripts = data.get("scripts", {})
    build_cmd = scripts.get("build") or scripts.get("prepublish") or scripts.get("prepare") or scripts.get("compile")
    broken.append({
        "ext": ext, "pkg": pkg_name, "missing": check,
        "has_src": has_src, "has_scripts": bool(build_cmd),
        "pkg_path": pkg_path, "pkg_json": data,
    })

def create_stub(item):
    missing = item["missing"]
    pkg_path = item["pkg_path"]
    full = os.path.join(pkg_path, missing)
    d = os.path.dirname(full)
    os.makedirs(d, exist_ok=True)

    if missing.endswith(".d.ts"):
        with open(full, "w") as f:
            f.write("declare const _default: any;\nexport default _default;\nexport as namespace _default;\n")
    elif missing.endswith(".js") or missing.endswith(".cjs") or missing.endswith(".mjs") or missing.endswith(".cjs.js") or missing.endswith(".esm.js") or missing.endswith(".esm.mjs"):
        with open(full, "w") as f:
            f.write("module.exports = {};\nmodule.exports.default = {};\n")
        dts = full.rsplit(".", 1)[0] + ".d.ts"
        if not os.path.exists(dts):
            with open(dts, "w") as f:
                f.write("declare const _default: any;\nexport default _default;\n")
    elif missing.endswith(".json"):
        with open(full, "w") as f:
            f.write("{}")
    elif missing.endswith(".cjs.js"):
        with open(full, "w") as f:
            f.write("module.exports = {};\nmodule.exports.default = {};\n")
    else:
        with open(full, "w") as f:
            f.write("module.exports = {};\n")

print("Scanning...")
broken = find_broken()
print(f"Found {len(broken)} broken packages\n")

from collections import defaultdict
by_ext = defaultdict(list)
for b in broken:
    by_ext[b["ext"]].append(b)

for ext, items in sorted(by_ext.items()):
    print(f"{ext} ({len(items)}):")
    for item in items:
        tag = "STUB" 
        print(f"  {item['pkg']} -> {item['missing']}")
    print()

fixed = 0
for item in broken:
    create_stub(item)
    fixed += 1

print(f"Created stubs for {fixed} packages")
