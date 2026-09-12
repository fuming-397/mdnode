#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
serve.py — 本地开发服务器（仅用于本地预览，部署时不需要）

解决的问题：
    浏览器的 ES Module 与 fetch 不能通过 file:// 协议工作，必须经由 HTTP
    访问（这一点无法在网页内绕开）。

路由说明：
    站内地址都是真实存在的文件（/posts.html、/post.html?id=x），因此本服务器
    不需要任何重写就与线上一致。下面的 REWRITES 只是为方便测试旧的无后缀
    链接（/posts）而保留的便利规则，与部署无关。

用法：
    python3 tools/serve.py            # 默认 http://127.0.0.1:8000
    python3 tools/serve.py --port 4321 --open
"""

import argparse
import http.server
import os
import socketserver
import sys
import webbrowser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 旧的无后缀链接 → 真实文件（仅为本地测试方便；线上由 route-recover.js 兜底）
REWRITES = {
    "/": "index.html",
    "/index": "index.html",
    "/posts": "posts.html",
    "/post": "post.html",
    "/search": "search.html",
    "/404": "404.html",
}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):  # noqa: N802 (保持标准库命名)
        raw_path, _, query = self.path.partition("?")
        path = raw_path.rstrip("/") or "/"

        target = REWRITES.get(path)

        if target is None:
            fs_path = os.path.join(ROOT, path.lstrip("/"))
            if os.path.isfile(fs_path):
                # 真实存在的文件（含 .nojekyll 这类无扩展名文件）直接返回
                target = None
            elif not os.path.splitext(path)[1]:
                # 未知的无扩展名路径：尝试 <path>.html，否则回退 404 页面
                candidate = os.path.join(ROOT, path.lstrip("/") + ".html")
                if os.path.isfile(candidate):
                    target = path.lstrip("/") + ".html"
                else:
                    target = "404.html"

        if target is not None:
            self.path = "/" + target + (("?" + query) if query else "")

        super().do_GET()

    def end_headers(self):
        # 开发时禁用缓存，避免改了文件看不到效果
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def guess_type(self, path):
        if path.lower().endswith((".md", ".markdown")):
            return "text/markdown; charset=utf-8"
        return super().guess_type(path)

    def log_message(self, fmt, *args):
        sys.stderr.write("[serve] %s\n" % (fmt % args))


class ReusableTCPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main():
    parser = argparse.ArgumentParser(description="MDNode 本地预览服务器")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--open", action="store_true", help="启动后自动打开浏览器")
    args = parser.parse_args()

    url = f"http://{args.host}:{args.port}/"
    with ReusableTCPServer((args.host, args.port), Handler) as httpd:
        print(f"[serve] 根目录：{ROOT}")
        print(f"[serve] 访问地址：{url}")
        print("[serve] 按 Ctrl+C 停止")
        if args.open:
            webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[serve] 已停止")


if __name__ == "__main__":
    main()
