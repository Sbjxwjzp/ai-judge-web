# -*- coding: utf-8 -*-
"""深色 16:9 deck 对比度审计：每页背景亮度（应低）+ 亮文字像素比例（应存在）。
用法: python scripts/check_deck_pdf.py <deck.pdf>
"""
import sys
import pymupdf
import numpy as np
from PIL import Image

pdf = sys.argv[1]
doc = pymupdf.open(pdf)
bad = []
for i in range(doc.page_count):
    pix = doc[i].get_pixmap(dpi=72)
    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    arr = np.array(img).astype(float)
    lum = arr.mean(axis=2)
    mean_bg = lum.mean()
    dark_ratio = (lum < 90).mean()
    light_ratio = (lum > 150).mean()
    ok_bg = mean_bg < 100
    ok_text = light_ratio > 0.5 / 100
    status = "PASS" if (ok_bg and ok_text) else "FAIL"
    if not (ok_bg and ok_text):
        bad.append(i + 1)
    print(f"{status}  p{i+1:02d}  背景均值 {mean_bg:5.0f}  暗像素 {dark_ratio:6.1%}  亮文字 {light_ratio:6.2%}")
print()
if bad:
    print(f"RESULT  {len(bad)} 页对比度异常: {bad}  -> 需检查")
    sys.exit(1)
print("RESULT  全部页面背景为深色且含亮文字  ->  深色 deck 对比度正常")
