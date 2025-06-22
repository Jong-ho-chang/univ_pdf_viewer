import os
import json

pdf_dir = "pdfs"  # PDF 폴더 경로
output_file = os.path.join(pdf_dir, "index.json")

# pdf 확장자 파일 목록만 추출
pdf_files = [f for f in os.listdir(pdf_dir) if f.endswith(".pdf")]

# JSON 저장
with open(output_file, "w", encoding="utf-8") as f:
    json.dump({"files": pdf_files}, f, ensure_ascii=False, indent=2)

print(f"{len(pdf_files)}개의 PDF가 index.json에 저장되었습니다.")