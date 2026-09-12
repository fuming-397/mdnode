#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build-manifest.py — 扫描 posts/ 目录，生成文章清单与离线内容包

为什么需要它？
    纯静态托管平台无法在前端列出目录，因此需要一个清单文件告诉页面「有哪些
    Markdown 文件」。清单里只保存文件名，不保存任何语义信息；唯一 ID 与标题
    等元数据仍然只存在于 Markdown 文件开头。

同时生成 data/posts.bundle.json（离线兜底内容包）：
    前端默认直接抓取 posts/*.md（数据完全来自 Markdown）。但如果托管平台
    不原样提供 .md —— 典型例子是 GitHub Pages 少了 .nojekyll，Jekyll 会把
    以 --- 开头的文章编译成 HTML —— 抓取就会失败。此时前端自动改用内容包里的
    同一份原文，因此站点在任何静态托管上都能读到文章。
    内容包是抓取时的快照：修改正文后若希望兜底内容也是最新的，请重新运行本脚本；
    在能正常提供 .md 的平台上，正文始终以最新 .md 为准，无需重新生成。

用法：
    python3 tools/build-manifest.py                # 生成/更新清单与内容包
    python3 tools/build-manifest.py --check        # 仅检查两者是否为最新（CI 可用）
    python3 tools/build-manifest.py --no-bundle    # 只生成清单，不生成内容包
    python3 tools/build-manifest.py --posts-dir posts --output data/posts.manifest.json

仅使用 Python 标准库，无第三方依赖。
"""

import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timezone

# 项目根目录（本脚本位于 <root>/tools/ 下）
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_POSTS_DIR = os.path.join(ROOT, "posts")
DEFAULT_OUTPUT = os.path.join(ROOT, "data", "posts.manifest.json")
DEFAULT_BUNDLE = os.path.join(ROOT, "data", "posts.bundle.json")

MARKDOWN_EXTENSIONS = (".md", ".markdown")


def collect_files(posts_dir):
    """返回按名称排序的 Markdown 文件名列表（不含路径）。"""
    if not os.path.isdir(posts_dir):
        raise SystemExit(f"[build-manifest] 目录不存在：{posts_dir}")

    files = []
    for name in os.listdir(posts_dir):
        full = os.path.join(posts_dir, name)
        if not os.path.isfile(full):
            continue
        if name.lower().endswith(MARKDOWN_EXTENSIONS) and not name.startswith("."):
            files.append(name)
    return sorted(files, key=lambda item: item.lower())


def compute_hash(posts_dir, files):
    """基于文件名 + 大小 + 修改时间生成稳定指纹，用于前端缓存失效。"""
    digest = hashlib.sha1()
    for name in files:
        stat = os.stat(os.path.join(posts_dir, name))
        digest.update(f"{name}:{stat.st_size}:{int(stat.st_mtime)}".encode("utf-8"))
    return digest.hexdigest()[:12]


def build_manifest(posts_dir):
    files = collect_files(posts_dir)
    return {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "generator": "tools/build-manifest.py",
        "count": len(files),
        "hash": compute_hash(posts_dir, files),
        "files": files,
    }


def read_text(path):
    """读取 Markdown 原文；非法 UTF-8 字节用替换字符处理，保证脚本不中断。"""
    with open(path, "rb") as handle:
        raw = handle.read()
    return raw.decode("utf-8", errors="replace")


def build_bundle(posts_dir, manifest):
    """生成离线兜底内容包：文件名 → Markdown 原文（含元数据）。"""
    return {
        "generatedAt": manifest["generatedAt"],
        "generator": "tools/build-manifest.py",
        "note": "离线兜底内容包：平台不原样提供 .md 时由前端替代读取。修改正文后请重新运行 tools/build-manifest.py。",
        "count": manifest["count"],
        "hash": manifest["hash"],
        "files": {name: read_text(os.path.join(posts_dir, name)) for name in manifest["files"]},
    }


def write_json(path, payload, indent=2):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=indent)
        handle.write("\n")


def main(argv=None):
    parser = argparse.ArgumentParser(description="生成 MDNode 文章清单与离线内容包")
    parser.add_argument("--posts-dir", default=DEFAULT_POSTS_DIR, help="Markdown 文章目录")
    parser.add_argument("--output", default=DEFAULT_OUTPUT, help="清单输出路径")
    parser.add_argument("--bundle-output", default=DEFAULT_BUNDLE, help="离线内容包输出路径")
    parser.add_argument("--no-bundle", action="store_true", help="不生成离线内容包")
    parser.add_argument("--check", action="store_true", help="仅检查文件是否最新，不写入")
    args = parser.parse_args(argv)

    manifest = build_manifest(args.posts_dir)

    if args.check:
        try:
            with open(args.output, "r", encoding="utf-8") as handle:
                current = json.load(handle)
        except (OSError, ValueError):
            print(f"[build-manifest] 清单缺失或损坏：{args.output}", file=sys.stderr)
            return 1

        if current.get("files") != manifest["files"]:
            print("[build-manifest] 清单已过期，请运行 python3 tools/build-manifest.py", file=sys.stderr)
            return 1

        if not args.no_bundle:
            try:
                with open(args.bundle_output, "r", encoding="utf-8") as handle:
                    bundle = json.load(handle)
            except (OSError, ValueError):
                print(f"[build-manifest] 内容包缺失或损坏：{args.bundle_output}", file=sys.stderr)
                return 1
            if sorted(bundle.get("files", {})) != sorted(manifest["files"]):
                print("[build-manifest] 内容包已过期，请运行 python3 tools/build-manifest.py", file=sys.stderr)
                return 1

        print(f"[build-manifest] 清单是最新的（{len(manifest['files'])} 个文件）")
        return 0

    write_json(args.output, manifest)
    print(f"[build-manifest] 已写入 {os.path.relpath(args.output, ROOT)}")
    print(f"[build-manifest] 共 {manifest['count']} 个文件，指纹 {manifest['hash']}")
    for name in manifest["files"]:
        print(f"  - {name}")

    if not args.no_bundle:
        bundle = build_bundle(args.posts_dir, manifest)
        write_json(args.bundle_output, bundle)
        total = sum(len(text) for text in bundle["files"].values())
        print(f"[build-manifest] 已写入 {os.path.relpath(args.bundle_output, ROOT)}（{len(bundle['files'])} 篇，约 {total} 字符）")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
