"""Refresh the public, text-only selection from Alejo's #too-much-ai channel.

Run locally with no arguments to preview or with --publish to update main.
For individually reviewed posts, add the reviewed text and links to feed.json.
Every refresh checks previously reviewed entries against Slack again.
"""
import argparse
import base64
import html
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
FEED = ROOT / "public/feed.json"
ENDPOINT = "repos/alejoacelas/personal-webpage/contents/public/feed.json"
SLACK = Path.home() / ".codex/skills/use-slack/scripts/slack.py"
AUTHOR = "U0957U3CJMV"
CHANNEL = "C0B9PH0TA7J"
CHANNEL_NAME = "too-much-ai"
LINK = re.compile(r"<(https://[^<>|\s]+)(?:\|([^<>]+))?>")
# These specific pages contain public research tools. Other links need review.
PUBLIC_LINKS = {
    "https://metascienceobservatory.org/forensic-metascience-ai-toolkit",
    "https://github.com/The-Metascience-Observatory/forensic-metascience-ai-toolkit",
    "https://github.com/The-Metascience-Observatory/fetchpdf",
}
# Limited to general AI work and ordinary joining words. New names, unusual
# capitalisation, numbers, identifiers and open-ended URLs all require review.
WORDS = set("""
m ve d re t s ll
a about actually add after again agent agents all also always am an and another any anyone anything app
apps are as ask asking at automate automated automating automation back be because been before behind best
better between big both browser browsers build building built by can change changing chat chats check
checking clearer code coding command commands compare comparing computer computers connecting connection
connections consistent consistently context could create creating custom data day days debug debugging
describe desktop detail details dictation did different differently difficult do document documentation
documents does doing done draft drafts each easier easily easy edit editing edits efficient else end enjoy
enough even ever every example examples experiment experimenting explain explaining explore exploring
faster feedback few file files find finding finish first focus focused for found frequently from full
general generate generated generating getting give given giving go going good got great habit habits had
handle handling hard harder has have having help helpful helps here how i idea ideas if improve improved
improving in input inputs instead instructions interface interfaces into is it its itself just keep keeping
keyboard know last later learn learning less let like link links little local long longer looking lot lots
make makes making manage managing many may me minutes model models more most much multiple my need new
next no notes now of off often on once one only open opening or other out output outputs over own parallel
parallelism part parts people perhaps plan planning plans please point possible practice prefer pretty
previous process processes processing productivity program programming project projects prompt prompting
prompts question questions quick quickly quite read reading really recent recently recommend reduce
reducing related repeat repeated repeatedly request requests research result results retry reuse review
reviewing run running runs same save saved saving say scan scanning schedule scheduling script scripts
search searching second see seems seen separate session sessions set setting settings setup several share
shared sharing short shorter should simple simpler since single skill skills so software some something
sometimes sort source sources spend spending split splitting start started starting step steps still stop
such suggest suggestions summary summaries summarise summarize switch switching system systems take takes
taking task tasks template templates test testing text than that the them then there these thing things
think thinking this those through time times tip tips to together tool tools tracking tried try trying turn
two type types typing up use used useful user users uses using usually value want was way ways week weeks
well were what when where whether which while why will window windows with without work worked workflow
workflows working works would write writing yes yet you your
""".split())
PRODUCTS = set("AI Asana ChatGPT Claude Code Codex Drive Gmail Markdown MCP Slack".split())
START = re.compile(r"^(?:I |I['’](?:m|ve|d) |What |How |Why |Which |When |Does |Do |Is |Are |Has |Can )")


def run(command, **kwargs):
    return subprocess.run(command, check=True, capture_output=True, text=True, **kwargs).stdout


def slack(*args):
    return json.loads(run([sys.executable, str(SLACK), "-w", "ai-uplift", *args],
                          env={**os.environ, "SLACK_READONLY": "1"}))


def post_from(message):
    ts = message.get("ts", "")
    if (message.get("type") != "message" or message.get("user") != AUTHOR
            or message.get("subtype") or message.get("bot_id")
            or message.get("thread_ts", ts) != ts or not re.fullmatch(r"\d+\.\d+", ts)):
        return None
    raw = message.get("text", "")
    links = []

    def link_text(match):
        url = html.unescape(match[1])
        label = html.unescape(match[2] or url)
        links.append({"url": url, "label": label})
        return label

    text = LINK.sub(link_text, raw)
    # Slack <@user>, <#channel>, <!subteam>, file links and email links.
    if re.search(r"[<>@]|https?://|www\.", text, re.I):
        return None
    return {"ts": ts, "text": html.unescape(text), "links": links}


def automatic(post, member_names):
    text = post["text"]
    if post["links"] or not START.match(text) or not 40 <= len(text) <= 900:
        return False
    if not re.fullmatch(r"[A-Za-z ,?.!\n'’\-]+", text):
        return False
    # Contraction endings are checked as separate words. Display always uses Slack's text.
    words = re.findall(r"[A-Za-z]+", text.lower())
    if not {"ai", "agent", "agents", "workflow", "workflows", "prompt", "prompts",
            "claude", "codex", "chatgpt", "coding", "automation"}.intersection(words):
        return False
    for match in re.finditer(r"[A-Za-z]+", text):
        token = match[0]
        if token == "AI" or (token in PRODUCTS and token.casefold() not in member_names):
            continue
        if token.lower() not in WORDS:
            return False
        if token.lower() in member_names and token != "I":
            return False
        if token != token.lower() and token != "I":
            before = text[:match.start()].rstrip()
            if (before and before[-1] not in ".?!") or token != token.capitalize():
                return False
    return True


def refresh(previous):
    identity = slack("auth")
    if identity["team_id"] != "T094GSSSF3M" or identity["user_id"] != AUTHOR:
        raise RuntimeError("Unexpected Slack account")
    names = slack("user-lookup")
    if AUTHOR not in names:
        raise RuntimeError("Author missing from workspace directory")
    member_names = {word.casefold() for member, name in names.items() if member != AUTHOR
                    for word in re.findall(r"[A-Za-z]+", name) if len(word) > 1}
    history = slack("history", CHANNEL, "100")["messages"]
    reviewed = {p["ts"]: p for p in previous["posts"]}
    selected = []
    for message in sorted(history, key=lambda m: m["ts"], reverse=True):
        post = post_from(message)
        if not post or any(link["url"] not in PUBLIC_LINKS for link in post["links"]):
            continue
        if post == reviewed.get(post["ts"]) or automatic(post, member_names):
            selected.append(post)
    return {"channel": CHANNEL_NAME, "posts": selected[:8]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--publish", action="store_true")
    args = parser.parse_args()
    if args.publish:
        if run(["gh", "api", "user", "--jq", ".login"]).strip() != "alejoacelas":
            raise RuntimeError("Expected alejoacelas GitHub account")
        remote = json.loads(run(["gh", "api", ENDPOINT + "?ref=main"]))
        previous = json.loads(base64.b64decode(remote["content"]))
    else:
        previous = json.loads(FEED.read_text())
    result = refresh(previous)
    content = json.dumps(result, indent=2, ensure_ascii=False) + "\n"
    if not args.publish:
        print(content, end="")
    elif result != previous:
        request = {"branch": "main", "sha": remote["sha"], "message": "Refresh Slack posts",
                   "content": base64.b64encode(content.encode()).decode()}
        run(["gh", "api", "--method", "PUT", ENDPOINT, "--input", "-"], input=json.dumps(request))


if __name__ == "__main__":
    main()
