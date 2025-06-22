// viewer.js - 전체 수정 버전 with 정확한 하이라이트 위치 및 중복 페이지 조회 방지 + 엔터키로 대학 조회

document.addEventListener("DOMContentLoaded", () => {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

  let pdfFiles = [];
  let pdfDoc = null;
  let currentPage = 1;
  let allPageTextItems = [];
  let searchResults = [];
  let currentSearchIndex = -1;
  let currentKeyword = '';

  const canvas = document.getElementById("pdf-canvas");
  const ctx = canvas.getContext("2d");
  const pageNumSpan = document.getElementById("page-num");
  const pageCountSpan = document.getElementById("page-count");
  const pageSelect = document.getElementById("page-select");
  const prevBtn = document.getElementById("prev-page");
  const nextBtn = document.getElementById("next-page");
  const keywordInput = document.getElementById("keyword-input");
  const keywordBtn = document.getElementById("keyword-btn");
  const nextMatchBtn = document.getElementById("next-match-btn");
  const resultInfo = document.getElementById("result-info");
  const canvasContainer = document.querySelector(".canvas-container");
  const univInput = document.getElementById("univ-input");
  const univBtn = document.getElementById("univ-btn");
  const univSelect = document.getElementById("univ-select");
  const univSelectContainer = document.getElementById("univ-select-container");

  let scale = 1.5;

  function createHighlightLayer() {
    let layer = document.getElementById("highlight-layer");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "highlight-layer";
      layer.style.position = "absolute";
      layer.style.top = "0";
      layer.style.left = "0";
      layer.style.zIndex = 10;
      layer.style.pointerEvents = "none";
      canvasContainer.appendChild(layer);
    }
    return layer;
  }

  function clearHighlights() {
    const layer = document.getElementById("highlight-layer");
    if (layer) layer.innerHTML = '';
  }

  function normalizeText(text) {
    return text.normalize('NFC').toLowerCase().replace(/\s+/g, '').replace(/[^가-힣a-z0-9]/g, '');
  }

  function renderPage(num, callback) {
    pdfDoc.getPage(num).then(page => {
      const viewport = page.getViewport({ scale });
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = { canvasContext: ctx, viewport };
      page.render(renderContext).promise.then(() => {
        pageNumSpan.textContent = num;
        currentPage = num;
        highlightMatchesOnPage(num, viewport);
        if (callback) callback();
      });
    });
  }

  function highlightMatchesOnPage(pageNum, viewport) {
    clearHighlights();
    const matches = searchResults.filter(r => r.page === pageNum);
    const layer = createHighlightLayer();

    matches.forEach(m => {
      const transform = pdfjsLib.Util.transform(viewport.transform, m.transform);
      const x = transform[4];
      const y = transform[5] - m.height;

      const div = document.createElement("div");
      div.style.position = "absolute";
      div.style.left = `${x}px`;
      div.style.top = `${y}px`;
      div.style.width = `${m.width}px`;
      div.style.height = `${m.height}px`;
      div.style.backgroundColor = "rgba(255, 255, 0, 0.5)";
      layer.appendChild(div);
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
    if (searchResults.length > 0) {
      currentSearchIndex = 0;
      goToSearchResult(0);
    }
  }

  function goToSearchResult(index) {
    const match = searchResults[index];
    if (match && match.page !== currentPage) {
      renderPage(match.page);
    } else {
      highlightMatchesOnPage(currentPage);
    }
  }

  function nextMatch() {
    if (searchResults.length === 0) return;
    currentSearchIndex = (currentSearchIndex + 1) % searchResults.length;
    goToSearchResult(currentSearchIndex);
  }

  function loadPdf(url) {
    pdfjsLib.getDocument(url).promise.then(pdf => {
      pdfDoc = pdf;
      pageCountSpan.textContent = pdf.numPages;
      const promises = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        promises.push(
          pdf.getPage(i).then(page =>
            page.getTextContent().then(content => content.items)
          )
        );
      }

      Promise.all(promises).then(results => {
        allPageTextItems = results;
        renderPage(1);

        pageSelect.innerHTML = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const option = document.createElement("option");
          option.value = i;
          option.textContent = `${i} 페이지`;
          pageSelect.appendChild(option);
        }
      });
    });
  }

  keywordBtn.addEventListener("click", () => {
    const keyword = keywordInput.value.trim();
    if (keyword) searchAllPages(keyword);
  });

  nextMatchBtn.addEventListener("click", () => {
    nextMatch();
  });

  prevBtn.addEventListener("click", () => {
    if (currentPage > 1) renderPage(currentPage - 1);
  });

  nextBtn.addEventListener("click", () => {
    if (currentPage < pdfDoc.numPages) renderPage(currentPage + 1);
  });

  pageSelect.addEventListener("change", e => {
    const selected = parseInt(e.target.value);
    if (!isNaN(selected)) renderPage(selected);
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
      univInput.placeholder = "🏫 원하는 대학 이름을 입력하세요...";
    })
    .catch(err => {
      console.error("PDF 목록 로드 오류:", err);
      univInput.placeholder = "PDF 목록 로딩 실패";
    });
});