// viewer.js - scroll view mode (e-book style)
document.addEventListener("DOMContentLoaded", () => {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

  let pdfFiles = [];
  let pdfDoc = null;
  let allPageTextItems = [];
  let searchResults = [];
  let currentSearchIndex = -1;
  let currentKeyword = '';

  const scrollContainer = document.getElementById("scroll-container");
  const keywordInput = document.getElementById("keyword-input");
  const keywordBtn = document.getElementById("keyword-btn");
  const nextMatchBtn = document.getElementById("next-match-btn");
  const resultInfo = document.getElementById("result-info");
  const univInput = document.getElementById("univ-input");
  const univBtn = document.getElementById("univ-btn");
  const univSelect = document.getElementById("univ-select");
  const univSelectContainer = document.getElementById("univ-select-container");

  function normalizeText(text) {
    return text.normalize('NFC').toLowerCase().replace(/\s+/g, '').replace(/[^가-힣a-z0-9]/g, '');
  }

  function clearScrollContainer() {
    scrollContainer.innerHTML = '';
  }

  function renderAllPages(pdf) {
    clearScrollContainer();
    const promises = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      promises.push(
        pdf.getPage(i).then(page => {
          const viewport = page.getViewport({ scale: 1 });
          const containerWidth = scrollContainer.clientWidth;
          const scale = containerWidth / viewport.width;
          const scaledViewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          canvas.width = scaledViewport.width;
          canvas.height = scaledViewport.height;

          const div = document.createElement("div");
          div.appendChild(canvas);
          div.style.marginBottom = '20px';
          div.style.position = 'relative';
          div.setAttribute("data-page-number", i);
          scrollContainer.appendChild(div);

          return page.render({ canvasContext: context, viewport: scaledViewport }).promise.then(() => {
            return page.getTextContent().then(content => {
              allPageTextItems[i - 1] = content.items;
              highlightMatchesOnPage(i, scaledViewport, div);
            });
          });
        })
      );
    }

    return Promise.all(promises);
  }

  function highlightMatchesOnPage(pageNum, viewport, containerDiv) {
    const matches = searchResults.filter(r => r.page === pageNum);
    matches.forEach(m => {
      const transform = pdfjsLib.Util.transform(viewport.transform, m.transform);
      const x = transform[4];
      const y = transform[5] - m.height;

      const highlight = document.createElement("div");
      highlight.style.position = "absolute";
      highlight.style.left = `${x}px`;
      highlight.style.top = `${y}px`;
      highlight.style.width = `${m.width}px`;
      highlight.style.height = `${m.height}px`;
      highlight.style.backgroundColor = "rgba(255, 255, 0, 0.5)";
      highlight.style.pointerEvents = "none";

      containerDiv.appendChild(highlight);
    });
  }

  function searchAllPages(keyword) {
    searchResults = [];
    const normKeyword = normalizeText(keyword);
    currentSearchIndex = -1;
    currentKeyword = keyword;

    allPageTextItems.forEach((items, pageIndex) => {
      items.forEach(item => {
        const normText = normalizeText(item.str);
        if (normText.includes(normKeyword)) {
          searchResults.push({
            page: pageIndex + 1,
            str: item.str,
            transform: item.transform,
            width: item.width,
            height: item.height
          });
        }
      });
    });

    resultInfo.textContent = `${searchResults.length}건 검색됨`;
    renderAllPages(pdfDoc); // Re-render to show highlights
  }

  function nextMatch() {
    if (searchResults.length === 0) return;
    currentSearchIndex = (currentSearchIndex + 1) % searchResults.length;
    const match = searchResults[currentSearchIndex];
    const target = scrollContainer.querySelector(`[data-page-number="${match.page}"]`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function loadPdf(url) {
    pdfjsLib.getDocument(url).promise.then(pdf => {
      pdfDoc = pdf;
      allPageTextItems = [];
      renderAllPages(pdf);
    });
  }

  keywordBtn.addEventListener("click", () => {
    const keyword = keywordInput.value.trim();
    if (keyword) searchAllPages(keyword);
  });

  nextMatchBtn.addEventListener("click", () => {
    nextMatch();
  });

  function triggerUnivSearch() {
    const query = univInput.value.trim().toLowerCase();
    if (!query) return;

    const matched = pdfFiles.filter(name => name.toLowerCase().includes(query));
    univSelect.innerHTML = '';

    if (matched.length === 0) {
      univSelectContainer.style.display = "none";
      alert("일치하는 대학 PDF가 없습니다.");
      return;
    }

    matched.forEach(file => {
      const option = document.createElement("option");
      option.value = file;
      option.textContent = file.replace(/\.pdf$/i, '');
      univSelect.appendChild(option);
    });

    univSelectContainer.style.display = "flex";

    if (matched.length === 1) {
      univSelect.selectedIndex = 0;
      loadPdf(`pdfs/${matched[0]}`);
    }
  }

  univBtn.addEventListener("click", triggerUnivSearch);
  univInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      triggerUnivSearch();
    }
  });

  univSelect.addEventListener("change", () => {
    const file = univSelect.value;
    if (file) loadPdf(`pdfs/${file}`);
  });

  fetch('pdfs/index.json')
    .then(res => res.json())
    .then(data => {
      pdfFiles = data.files || [];
      univBtn.disabled = false;
      univInput.placeholder = "🏫 대학 이름을 입력하세요......";
    })
    .catch(err => {
      console.error("PDF 목록 로드 오류:", err);
      univInput.placeholder = "PDF 목록 로딩 실패";
    });
});
