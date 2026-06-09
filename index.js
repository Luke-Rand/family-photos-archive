// JavaScript application logic for the Littlefield Family Photo Archive

document.addEventListener('DOMContentLoaded', () => {
  // Check if database is loaded
  if (!window.GALLERY_DATA) {
    console.error("Gallery data not found. Please make sure gallery_data.js exists and is loaded.");
    showErrorState("Database failed to load. Please run 'python optimize_photos.py' first.");
    return;
  }

  // Application State
  const state = {
    allPhotos: window.GALLERY_DATA,
    filteredPhotos: [...window.GALLERY_DATA],
    currentFilteredIndex: 0,
    filters: {
      search: "",
      decade: "all",
      tag: null,
      person: null
    },
    allPeople: [],
    allTags: [],
    config: {
      title: "Family Photo Archive",
      subtitle: "A collection of memories",
      description: "A beautifully curated web photo gallery.",
      slide_label: "FAMILY ARCHIVE",
      eras: [
        { id: "1960s", label: "1960s", start_year: 1960, end_year: 1969 },
        { id: "1970s", label: "1970s", start_year: 1970, end_year: 1979 }
      ]
    }
  };

  // DOM Elements
  const DOM = {
    galleryGrid: document.getElementById('gallery-grid'),
    searchInput: document.getElementById('search-input'),
    decadeButtonGroup: document.getElementById('decade-button-group'),
    tagButtonGroup: document.getElementById('tag-button-group'),
    peopleButtonGroup: document.getElementById('people-button-group'),
    activeFiltersDisplay: document.getElementById('active-filters-display'),
    btnToggleFilters: document.getElementById('btn-toggle-filters'),
    filtersCollapsible: document.getElementById('filters-collapsible'),
    filterCountBadge: document.getElementById('filter-count-badge'),
    currentCount: document.getElementById('current-count'),
    totalCount: document.getElementById('total-count'),
    
    // View/Edit Containers
    infoViewContainer: document.getElementById('info-view-container'),
    infoEditContainer: document.getElementById('info-edit-container'),
    btnOpenEdit: document.getElementById('btn-open-edit'),
    btnSaveEdit: document.getElementById('btn-save-edit'),
    btnCancelEdit: document.getElementById('btn-cancel-edit'),
    
    // Edit Input Fields
    editSubject: document.getElementById('edit-subject'),
    editDate: document.getElementById('edit-date'),
    editLocation: document.getElementById('edit-location'),
    editDescription: document.getElementById('edit-description'),
    editPeopleList: document.getElementById('edit-people-list'),
    editTagsList: document.getElementById('edit-tags-list'),
    addPersonInput: document.getElementById('add-person-input'),
    addTagInput: document.getElementById('add-tag-input'),
    addPersonSuggestions: document.getElementById('add-person-suggestions'),
    addTagSuggestions: document.getElementById('add-tag-suggestions'),
    
    // Stats elements
    statPhotosVal: document.getElementById('stat-photos-val'),
    statPeopleVal: document.getElementById('stat-people-val'),
    
    // Lightbox Elements
    lightbox: document.getElementById('lightbox'),
    lightboxClose: document.getElementById('lightbox-close'),
    lightboxPrev: document.getElementById('lightbox-prev'),
    lightboxNext: document.getElementById('lightbox-next'),
    lightboxImgWrapper: document.getElementById('lightbox-img-wrapper'),
    lightboxImg: document.getElementById('lightbox-img'),
    lightboxDate: document.getElementById('lightbox-date'),
    lightboxSubject: document.getElementById('lightbox-subject'),
    lightboxLocation: document.getElementById('lightbox-location'),
    lightboxDescription: document.getElementById('lightbox-description'),
    lightboxTagsList: document.getElementById('lightbox-tags-list'),
    lightboxPeopleList: document.getElementById('lightbox-people-list'),
    lightboxCustomList: document.getElementById('lightbox-custom-list'),
    lightboxDownload: document.getElementById('lightbox-download'),
    lightboxStage: document.getElementById('lightbox-stage'),
    
    // Sections for hiding/showing in Lightbox
    locSection: document.getElementById('lightbox-loc-section'),
    descSection: document.getElementById('lightbox-desc-section'),
    tagsSection: document.getElementById('lightbox-tags-section'),
    peopleSection: document.getElementById('lightbox-people-section'),
    customSection: document.getElementById('lightbox-custom-section')
  };

  // Touch Swipe State
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;
  let isMultiTouch = false;

  // Edit State
  let editingData = {
    people: [],
    tags: []
  };

  // Initialize Application
  init();

  async function init() {
    // Try to load configuration from config.json
    try {
      const response = await fetch('config.json');
      if (response.ok) {
        state.config = await response.json();
      }
    } catch (err) {
      console.warn("Could not load config.json, using defaults:", err);
    }

    // Apply configuration to elements
    applyConfiguration();

    // Render Era buttons dynamically
    renderEraButtons();

    // 1. Calculate and Render Stats
    calculateStats();

    // 2. Extract and Render Filter Pills
    renderFilterPills();

    // 2b. Extract unique metadata for autocomplete lists
    updateUniqueMetadataLists();

    // 3. Render Photo Grid
    applyFilters();

    // 4. Bind Event Listeners
    bindEvents();
  }

  function applyConfiguration() {
    if (state.config.title) {
      document.title = state.config.title;
      const mainTitle = document.getElementById('main-title');
      if (mainTitle) mainTitle.textContent = state.config.title;
    }
    if (state.config.subtitle) {
      const mainSubtitle = document.getElementById('main-subtitle');
      if (mainSubtitle) mainSubtitle.textContent = state.config.subtitle;
    }
    if (state.config.description) {
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute('content', state.config.description);
    }
  }

  function renderEraButtons() {
    const group = DOM.decadeButtonGroup;
    if (!group) return;
    group.innerHTML = '';

    // "All Eras" button
    const btnAll = document.createElement('button');
    btnAll.className = 'btn-filter active';
    btnAll.dataset.decade = 'all';
    btnAll.id = 'btn-decade-all';
    btnAll.textContent = 'All Eras';
    group.appendChild(btnAll);

    // Custom Eras
    if (state.config.eras && Array.isArray(state.config.eras)) {
      state.config.eras.forEach(era => {
        const btn = document.createElement('button');
        btn.className = 'btn-filter';
        btn.dataset.decade = era.id;
        btn.id = `btn-decade-${era.id}`;
        btn.textContent = era.label;
        group.appendChild(btn);
      });
    }

    // "Undated" button
    const btnUndated = document.createElement('button');
    btnUndated.className = 'btn-filter';
    btnUndated.dataset.decade = 'undated';
    btnUndated.id = 'btn-decade-undated';
    btnUndated.textContent = 'Undated';
    group.appendChild(btnUndated);
  }

  // --- UNIQUE METADATA EXTRACTION ---
  function updateUniqueMetadataLists() {
    const peopleSet = new Set();
    const tagsSet = new Set();
    state.allPhotos.forEach(p => {
      if (p.people && Array.isArray(p.people)) {
        p.people.forEach(person => {
          if (person && person.trim()) {
            peopleSet.add(person.trim());
          }
        });
      }
      if (p.tags && Array.isArray(p.tags)) {
        p.tags.forEach(tag => {
          if (tag && tag.trim()) {
            tagsSet.add(tag.trim());
          }
        });
      }
    });
    state.allPeople = Array.from(peopleSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    state.allTags = Array.from(tagsSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }

  // --- STATS CALCULATION ---
  function calculateStats() {
    DOM.totalCount.textContent = state.allPhotos.length;
    DOM.statPhotosVal.textContent = state.allPhotos.length;

    // Count unique people
    const peopleSet = new Set();
    state.allPhotos.forEach(p => {
      if (p.people && Array.isArray(p.people)) {
        p.people.forEach(person => peopleSet.add(person));
      }
    });
    DOM.statPeopleVal.textContent = peopleSet.size;

    // Calculate years span dynamically from actual photo dates
    let minYear = Infinity;
    let maxYear = -Infinity;
    state.allPhotos.forEach(p => {
      if (p.date) {
        const match = p.date.trim().match(/\d{4}$/);
        if (match) {
          const yr = parseInt(match[0], 10);
          if (yr < minYear) minYear = yr;
          if (yr > maxYear) maxYear = yr;
        }
      }
    });
    const spanVal = (minYear !== Infinity && maxYear !== -Infinity) ? `${minYear} - ${maxYear}` : 'N/A';
    const spanEl = document.getElementById('stat-span-val');
    if (spanEl) spanEl.textContent = spanVal;
  }

  // --- FILTER GENERATION & RENDERING ---
  function renderFilterPills() {
    // Count occurrences of tags and people for smart sorting (most popular first)
    const tagCounts = {};
    const peopleCounts = {};

    state.allPhotos.forEach(p => {
      if (p.tags) {
        p.tags.forEach(t => {
          tagCounts[t] = (tagCounts[t] || 0) + 1;
        });
      }
      if (p.people) {
        p.people.forEach(pe => {
          peopleCounts[pe] = (peopleCounts[pe] || 0) + 1;
        });
      }
    });

    // Sort tags and people by popularity
    const sortedTags = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]).slice(0, 15);
    const sortedPeople = Object.keys(peopleCounts).sort((a, b) => peopleCounts[b] - peopleCounts[a]).slice(0, 15);

    // Render tag buttons
    DOM.tagButtonGroup.innerHTML = '';
    sortedTags.forEach(tag => {
      const btn = document.createElement('button');
      btn.className = 'btn-filter';
      btn.dataset.tag = tag;
      btn.textContent = `${tag} (${tagCounts[tag]})`;
      btn.id = `btn-tag-${tag.replace(/\s+/g, '-')}`;
      DOM.tagButtonGroup.appendChild(btn);
    });

    // Render people buttons
    DOM.peopleButtonGroup.innerHTML = '';
    sortedPeople.forEach(person => {
      const btn = document.createElement('button');
      btn.className = 'btn-filter';
      btn.dataset.person = person;
      btn.textContent = `${person} (${peopleCounts[person]})`;
      btn.id = `btn-person-${person.replace(/\s+/g, '-')}`;
      DOM.peopleButtonGroup.appendChild(btn);
    });
  }

  // --- FILTERING LOGIC ---
  function applyFilters() {
    const { search, decade, tag, person } = state.filters;
    const query = search.trim().toLowerCase();

    state.filteredPhotos = state.allPhotos.filter(photo => {
      // 1. Search Query Filter
      if (query) {
        const matchesSubject = photo.subject && photo.subject.toLowerCase().includes(query);
        const matchesDesc = photo.description && photo.description.toLowerCase().includes(query);
        const matchesLoc = photo.location && photo.location.toLowerCase().includes(query);
        const matchesTags = photo.tags && photo.tags.some(t => t.toLowerCase().includes(query));
        const matchesPeople = photo.people && photo.people.some(p => p.toLowerCase().includes(query));
        
        if (!matchesSubject && !matchesDesc && !matchesLoc && !matchesTags && !matchesPeople) {
          return false;
        }
      }

      // 2. Era / Decade Filter
      if (decade !== 'all') {
        const dateStr = photo.date ? photo.date.trim() : '';
        const match = dateStr.match(/\d{4}$/);
        const year = match ? parseInt(match[0], 10) : NaN;
        
        if (decade === 'undated') {
          if (dateStr !== "") return false;
        } else {
          const matchingEra = state.config.eras.find(e => e.id === decade);
          if (matchingEra) {
            if (isNaN(year) || year < matchingEra.start_year || year > matchingEra.end_year) {
              return false;
            }
          } else {
            return false; // Era not defined in configuration
          }
        }
      }

      // 3. Tag Filter
      if (tag) {
        if (!photo.tags || !photo.tags.includes(tag)) return false;
      }

      // 4. Person Filter
      if (person) {
        if (!photo.people || !photo.people.includes(person)) return false;
      }

      return true;
    });

    // Update Counter UI
    DOM.currentCount.textContent = state.filteredPhotos.length;

    // Update active filter badge count
    let activeCount = 0;
    if (decade !== 'all') activeCount++;
    if (tag) activeCount++;
    if (person) activeCount++;
    
    if (activeCount > 0) {
      DOM.filterCountBadge.textContent = activeCount;
      DOM.filterCountBadge.style.display = 'inline-flex';
    } else {
      DOM.filterCountBadge.style.display = 'none';
    }

    // Render Grid Cards
    renderPhotoGrid();

    // Update active filter pills UI
    renderActiveFilterBadges();
  }

  function renderActiveFilterBadges() {
    DOM.activeFiltersDisplay.innerHTML = '';
    const { decade, tag, person, search } = state.filters;
    
    let hasFilters = false;

    if (decade !== 'all') {
      createBadge(`Era: ${decade}`, () => {
        state.filters.decade = 'all';
        updateDecadeButtonsActive();
        applyFilters();
      });
      hasFilters = true;
    }

    if (tag) {
      createBadge(`Tag: ${tag}`, () => {
        state.filters.tag = null;
        updatePillsActiveStates();
        applyFilters();
      });
      hasFilters = true;
    }

    if (person) {
      createBadge(`Person: ${person}`, () => {
        state.filters.person = null;
        updatePillsActiveStates();
        applyFilters();
      });
      hasFilters = true;
    }

    if (search.trim()) {
      createBadge(`Search: "${search.trim()}"`, () => {
        state.filters.search = "";
        DOM.searchInput.value = "";
        applyFilters();
      });
      hasFilters = true;
    }

    if (hasFilters) {
      const clearBtn = document.createElement('button');
      clearBtn.className = 'clear-filters-btn';
      clearBtn.id = 'btn-clear-all-filters';
      clearBtn.textContent = 'Clear All Filters';
      clearBtn.addEventListener('click', clearAllFilters);
      DOM.activeFiltersDisplay.appendChild(clearBtn);
    }
  }

  function createBadge(text, onRemove) {
    const badge = document.createElement('span');
    badge.className = 'card-pill';
    badge.style.display = 'inline-flex';
    badge.style.alignItems = 'center';
    badge.style.gap = '6px';
    badge.style.borderColor = 'var(--accent-terracotta)';
    badge.style.backgroundColor = 'rgba(211, 107, 87, 0.05)';
    badge.style.color = 'var(--accent-terracotta)';
    badge.style.fontWeight = '600';
    badge.textContent = text;

    const closeBtn = document.createElement('span');
    closeBtn.textContent = '×';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontWeight = '800';
    closeBtn.style.fontSize = '1.1rem';
    closeBtn.style.lineHeight = '1';
    closeBtn.addEventListener('click', onRemove);

    badge.appendChild(closeBtn);
    DOM.activeFiltersDisplay.appendChild(badge);
  }

  function clearAllFilters() {
    state.filters = {
      search: "",
      decade: "all",
      tag: null,
      person: null
    };
    DOM.searchInput.value = "";
    updateDecadeButtonsActive();
    updatePillsActiveStates();
    applyFilters();
  }

  function updateDecadeButtonsActive() {
    const buttons = DOM.decadeButtonGroup.querySelectorAll('.btn-filter');
    buttons.forEach(btn => {
      if (btn.dataset.decade === state.filters.decade) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function updatePillsActiveStates() {
    // Tags
    const tagButtons = DOM.tagButtonGroup.querySelectorAll('.btn-filter');
    tagButtons.forEach(btn => {
      if (btn.dataset.tag === state.filters.tag) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // People
    const peopleButtons = DOM.peopleButtonGroup.querySelectorAll('.btn-filter');
    peopleButtons.forEach(btn => {
      if (btn.dataset.person === state.filters.person) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // --- GRID RENDERING ---
  function renderPhotoGrid() {
    DOM.galleryGrid.innerHTML = '';

    if (state.filteredPhotos.length === 0) {
      DOM.galleryGrid.innerHTML = `
        <div class="empty-state" id="empty-state">
          <h3>No Photos Found</h3>
          <p>We couldn't find any slides matching your filter parameters. Try checking your spelling or selecting another filter criteria.</p>
          <button class="btn-filter active" id="btn-empty-reset" style="margin-top: 12px;">Reset Filters</button>
        </div>
      `;
      document.getElementById('btn-empty-reset').addEventListener('click', clearAllFilters);
      return;
    }

    state.filteredPhotos.forEach((photo, index) => {
      const card = document.createElement('article');
      card.className = 'photo-card';
      card.id = `card-${photo.filename.replace(/\.[^/.]+$/, "")}`;
      
      // Determine displays
      const titleDisplay = photo.subject || "Family Slide Archive";
      const dateDisplay = photo.date || "Date Unknown";
      
      // Render slide label badge (retro style slide frame numbering)
      const slideNum = photo.filename.replace(/[^\d]/g, "");
      const formattedNum = slideNum ? `#${slideNum}` : '';

      // Build card inner HTML
      card.innerHTML = `
        <div class="photo-card-img-wrapper">
          ${formattedNum ? `<div class="slide-badge">${formattedNum}</div>` : ''}
          <img class="photo-card-img" src="${photo.thumbnail}" alt="${titleDisplay} - ${dateDisplay}" loading="lazy">
        </div>
        <div class="photo-card-info">
          <span class="photo-card-date">${dateDisplay}</span>
          <h2 class="photo-card-subject">${titleDisplay}</h2>
          <div class="photo-card-meta-pills">
            ${photo.location ? `<span class="card-pill">${photo.location}</span>` : ''}
            ${photo.people && photo.people.length > 0 ? `<span class="card-pill">${photo.people[0]}</span>` : ''}
            ${photo.tags && photo.tags.length > 0 ? `<span class="card-pill">#${photo.tags[0]}</span>` : ''}
          </div>
        </div>
      `;

      // Event Click Handler
      card.addEventListener('click', () => {
        openLightbox(index);
      });

      DOM.galleryGrid.appendChild(card);
    });
  }

  // --- LIGHTBOX CONTROLLER ---
  function openLightbox(index) {
    state.currentFilteredIndex = index;
    updateLightboxContent();
    DOM.lightbox.showModal(); // HTML5 standard dialog show
    DOM.lightbox.classList.add('active');
    document.body.style.overflow = 'hidden'; // Lock scrolling
  }

  function closeLightbox() {
    DOM.lightbox.classList.remove('active');
    setTimeout(() => {
      DOM.lightbox.close(); // HTML5 dialog close
      document.body.style.overflow = ''; // Release scroll
      showViewMode(); // Revert to view mode
    }, 150); // Match transition duration
  }

  function navigateLightbox(direction) {
    let newIndex = state.currentFilteredIndex + direction;
    const len = state.filteredPhotos.length;

    // Loop around
    if (newIndex >= len) {
      newIndex = 0;
    } else if (newIndex < 0) {
      newIndex = len - 1;
    }

    state.currentFilteredIndex = newIndex;
    showViewMode(); // Revert to view mode for new photo
    updateLightboxContent();
  }

  function updateLightboxContent() {
    const photo = state.filteredPhotos[state.currentFilteredIndex];
    if (!photo) return;

    // Transition effect trigger
    DOM.lightboxImgWrapper.style.transform = 'scale(0.95)';
    setTimeout(() => {
      DOM.lightboxImg.src = photo.preview;
      DOM.lightboxImg.alt = photo.subject || "Family Slide Archive";
      DOM.lightboxImgWrapper.style.transform = 'scale(1)';
    }, 100);

    // Set retro handwritten slide label (e.g. LITTLEFIELD FAMILY ARCHIVE - IMG_0023.JPG)
    const slideLabel = state.config.slide_label || 'FAMILY ARCHIVE';
    DOM.lightboxImgWrapper.setAttribute('data-slide-label', `${slideLabel} - ${photo.filename}`);

    // Header values
    DOM.lightboxDate.textContent = photo.date || "Date Unknown";
    DOM.lightboxSubject.textContent = photo.subject || "Family Slide Archive";

    // Location
    if (photo.location) {
      DOM.locSection.style.display = 'block';
      DOM.lightboxLocation.textContent = photo.location;
    } else {
      DOM.locSection.style.display = 'none';
    }

    // Description
    if (photo.description) {
      DOM.descSection.style.display = 'block';
      DOM.lightboxDescription.textContent = photo.description;
    } else {
      DOM.descSection.style.display = 'none';
    }

    // Download high res link
    DOM.lightboxDownload.href = photo.original;
    DOM.lightboxDownload.setAttribute('download', photo.filename);

    // Tag pills
    DOM.lightboxTagsList.innerHTML = '';
    if (photo.tags && photo.tags.length > 0) {
      DOM.tagsSection.style.display = 'block';
      photo.tags.forEach(tag => {
        const pill = document.createElement('span');
        pill.className = 'lightbox-pill';
        pill.textContent = `#${tag}`;
        pill.id = `lightbox-tag-${tag.replace(/\s+/g, '-')}`;
        pill.addEventListener('click', () => {
          closeLightbox();
          state.filters.tag = tag;
          updatePillsActiveStates();
          applyFilters();
        });
        DOM.lightboxTagsList.appendChild(pill);
      });
    } else {
      DOM.tagsSection.style.display = 'none';
    }

    // People pills
    DOM.lightboxPeopleList.innerHTML = '';
    if (photo.people && photo.people.length > 0) {
      DOM.peopleSection.style.display = 'block';
      photo.people.forEach(person => {
        const pill = document.createElement('span');
        pill.className = 'lightbox-pill people-pill';
        pill.textContent = person;
        pill.id = `lightbox-person-${person.replace(/\s+/g, '-')}`;
        pill.addEventListener('click', () => {
          closeLightbox();
          state.filters.person = person;
          updatePillsActiveStates();
          applyFilters();
        });
        DOM.lightboxPeopleList.appendChild(pill);
      });
    } else {
      DOM.peopleSection.style.display = 'none';
    }

    // Custom Fields
    DOM.lightboxCustomList.innerHTML = '';
    const customKeys = Object.keys(photo.custom || {});
    if (customKeys.length > 0) {
      DOM.customSection.style.display = 'block';
      customKeys.forEach(key => {
        const item = document.createElement('div');
        item.className = 'lightbox-custom-item';
        item.innerHTML = `
          <span class="lightbox-custom-lbl">${key}</span>
          <span class="lightbox-custom-val">${photo.custom[key]}</span>
        `;
        DOM.lightboxCustomList.appendChild(item);
      });
    } else {
      DOM.customSection.style.display = 'none';
    }


  }

  // --- BIND EVENT LISTENERS ---
  function bindEvents() {
    // 1. Search text input
    let searchDebounceTimeout;
    DOM.searchInput.addEventListener('input', (e) => {
      clearTimeout(searchDebounceTimeout);
      searchDebounceTimeout = setTimeout(() => {
        state.filters.search = e.target.value;
        applyFilters();
      }, 300); // Debounce search for fluid typing
    });

    // Toggle filters panel on mobile
    DOM.btnToggleFilters.addEventListener('click', () => {
      const isExpanded = DOM.btnToggleFilters.getAttribute('aria-expanded') === 'true';
      DOM.btnToggleFilters.setAttribute('aria-expanded', !isExpanded);
      DOM.filtersCollapsible.classList.toggle('show');
    });

    // 2. Decade filter buttons click
    DOM.decadeButtonGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-filter');
      if (!btn) return;

      const decade = btn.dataset.decade;
      state.filters.decade = decade;

      updateDecadeButtonsActive();
      applyFilters();
    });

    // 3. Tag filter pills click
    DOM.tagButtonGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-filter');
      if (!btn) return;

      const tag = btn.dataset.tag;
      if (state.filters.tag === tag) {
        state.filters.tag = null; // Toggle off
      } else {
        state.filters.tag = tag;
      }

      updatePillsActiveStates();
      applyFilters();
    });

    // 4. People filter pills click
    DOM.peopleButtonGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-filter');
      if (!btn) return;

      const person = btn.dataset.person;
      if (state.filters.person === person) {
        state.filters.person = null; // Toggle off
      } else {
        state.filters.person = person;
      }

      updatePillsActiveStates();
      applyFilters();
    });



    // 6. Lightbox action handlers
    DOM.lightboxClose.addEventListener('click', closeLightbox);
    DOM.lightboxPrev.addEventListener('click', () => navigateLightbox(-1));
    DOM.lightboxNext.addEventListener('click', () => navigateLightbox(1));
    
    // Close lightbox on dialog backdrop click
    DOM.lightbox.addEventListener('click', (e) => {
      if (e.target === DOM.lightbox) {
        closeLightbox();
      }
    });

    // 7. Annotation edit handlers
    DOM.btnOpenEdit.addEventListener('click', showEditMode);
    DOM.btnCancelEdit.addEventListener('click', showViewMode);
    DOM.btnSaveEdit.addEventListener('click', saveMetadataChanges);
    
    // Add tag input listeners on Enter key
    DOM.addPersonInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const value = DOM.addPersonInput.value.trim();
        if (value && !editingData.people.includes(value)) {
          editingData.people.push(value);
          renderEditPills('people', DOM.editPeopleList, editingData.people);
          DOM.addPersonInput.value = '';
          hideAllAutocompleteSuggestions();
        }
      }
    });

    DOM.addTagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const value = DOM.addTagInput.value.trim().toLowerCase();
        if (value && !editingData.tags.includes(value)) {
          editingData.tags.push(value);
          renderEditPills('tags', DOM.editTagsList, editingData.tags);
          DOM.addTagInput.value = '';
          hideAllAutocompleteSuggestions();
        }
      }
    });

    // Autocomplete input listeners
    DOM.addPersonInput.addEventListener('input', () => {
      showAutocompleteSuggestions(DOM.addPersonInput, DOM.addPersonSuggestions, 'people', state.allPeople);
    });
    DOM.addPersonInput.addEventListener('focus', () => {
      showAutocompleteSuggestions(DOM.addPersonInput, DOM.addPersonSuggestions, 'people', state.allPeople);
    });

    DOM.addTagInput.addEventListener('input', () => {
      showAutocompleteSuggestions(DOM.addTagInput, DOM.addTagSuggestions, 'tags', state.allTags);
    });
    DOM.addTagInput.addEventListener('focus', () => {
      showAutocompleteSuggestions(DOM.addTagInput, DOM.addTagSuggestions, 'tags', state.allTags);
    });

    // Dismiss suggestions on click outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.autocomplete-wrapper')) {
        hideAllAutocompleteSuggestions();
      }
    });

    // Keyboard controls
    document.addEventListener('keydown', (e) => {
      if (!DOM.lightbox.classList.contains('active')) return;

      if (e.key === 'ArrowLeft') {
        navigateLightbox(-1);
      } else if (e.key === 'ArrowRight') {
        navigateLightbox(1);
      } else if (e.key === 'Escape') {
        e.preventDefault(); // Override default if needed
        closeLightbox();
      }
    });

    // Mobile swipe gestures on stage
    DOM.lightboxStage.addEventListener('touchstart', (e) => {
      if (e.touches.length > 1) {
        isMultiTouch = true;
      } else {
        isMultiTouch = false;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    DOM.lightboxStage.addEventListener('touchmove', (e) => {
      if (e.touches.length > 1) {
        isMultiTouch = true;
      }
    }, { passive: true });

    DOM.lightboxStage.addEventListener('touchend', (e) => {
      if (isMultiTouch) return; // Ignore swipes during zoom gestures
      
      touchEndX = e.changedTouches[0].clientX;
      touchEndY = e.changedTouches[0].clientY;
      handleSwipeGesture();
    }, { passive: true });
  }

  function handleSwipeGesture() {
    const swipeDistanceX = touchEndX - touchStartX;
    const swipeDistanceY = touchEndY - touchStartY;
    const swipeThreshold = 60; // minimum pixels to trigger swipe

    // Ignore vertical swipes or scrolls (e.g. details panel swipe)
    if (Math.abs(swipeDistanceY) > Math.abs(swipeDistanceX)) {
      return;
    }

    if (swipeDistanceX > swipeThreshold) {
      // Swipe Right -> Go to previous photo
      navigateLightbox(-1);
    } else if (swipeDistanceX < -swipeThreshold) {
      // Swipe Left -> Go to next photo
      navigateLightbox(1);
    }
  }

  // --- ANNOTATION EDITING MODE ---
  function showViewMode() {
    DOM.lightbox.classList.remove('editing');
    DOM.infoViewContainer.style.display = 'flex';
    DOM.infoEditContainer.style.display = 'none';
    hideAllAutocompleteSuggestions();
  }

  function showEditMode() {
    DOM.lightbox.classList.add('editing');
    DOM.infoViewContainer.style.display = 'none';
    DOM.infoEditContainer.style.display = 'flex';
    
    const photo = state.filteredPhotos[state.currentFilteredIndex];
    if (!photo) return;

    // Populate input fields
    DOM.editSubject.value = photo.subject || '';
    DOM.editDate.value = photo.date || '';
    DOM.editLocation.value = photo.location || '';
    DOM.editDescription.value = photo.description || '';
    
    // Copy tags arrays
    editingData.people = [...(photo.people || [])];
    editingData.tags = [...(photo.tags || [])];
    
    // Render list elements
    renderEditPills('people', DOM.editPeopleList, editingData.people);
    renderEditPills('tags', DOM.editTagsList, editingData.tags);
    
    // Clear add tag inputs
    DOM.addPersonInput.value = '';
    DOM.addTagInput.value = '';
    hideAllAutocompleteSuggestions();
  }

  function renderEditPills(type, container, list) {
    container.innerHTML = '';
    
    if (list.length === 0) {
      container.innerHTML = `<span style="font-size: 0.85rem; color: var(--text-muted); font-style: italic;">None added yet</span>`;
      return;
    }
    
    list.forEach((item, idx) => {
      const pill = document.createElement('span');
      pill.className = 'edit-pill';
      pill.textContent = type === 'tags' ? `#${item}` : item;
      
      const removeBtn = document.createElement('span');
      removeBtn.className = 'edit-pill-remove';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => {
        list.splice(idx, 1);
        renderEditPills(type, container, list);
      });
      
      pill.appendChild(removeBtn);
      container.appendChild(pill);
    });
  }

  function saveMetadataChanges() {
    const photo = state.filteredPhotos[state.currentFilteredIndex];
    if (!photo) return;
    
    const subject = DOM.editSubject.value.trim();
    const date = DOM.editDate.value.trim();
    const location = DOM.editLocation.value.trim();
    const description = DOM.editDescription.value.trim();
    const people = editingData.people;
    const tags = editingData.tags;
    
    DOM.btnSaveEdit.disabled = true;
    DOM.btnSaveEdit.textContent = 'Saving...';
    
    fetch('/api/update-metadata', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filename: photo.filename,
        subject,
        date,
        location,
        description,
        people,
        tags
      })
    })
    .then(res => {
      if (!res.ok) throw new Error("HTTP error " + res.status);
      return res.json();
    })
    .then(data => {
      if (data.success && data.photo) {
        const updatedPhoto = data.photo;
        
        // 1. Update in-memory state.allPhotos
        const idxAll = state.allPhotos.findIndex(p => p.filename === updatedPhoto.filename);
        if (idxAll !== -1) {
          state.allPhotos[idxAll] = updatedPhoto;
        }
        
        // 2. Update state.filteredPhotos
        state.filteredPhotos[state.currentFilteredIndex] = updatedPhoto;
        
        // 3. Update window.GALLERY_DATA (global)
        const idxGlobal = window.GALLERY_DATA.findIndex(p => p.filename === updatedPhoto.filename);
        if (idxGlobal !== -1) {
          window.GALLERY_DATA[idxGlobal] = updatedPhoto;
        }
        
        // 4. Update Stats, Filter Pills & Unique Lists
        calculateStats();
        renderFilterPills();
        updateUniqueMetadataLists();
        
        // 5. Apply filters & re-render Grid
        applyFilters();
        
        // 6. Return to View Mode and refresh lightbox
        showViewMode();
        updateLightboxContent();
      } else {
        alert("Failed to save changes: " + (data.error || "Unknown error"));
      }
    })
    .catch(err => {
      console.error("Save error:", err);
      alert("Error saving: " + err.message);
    })
    .finally(() => {
      DOM.btnSaveEdit.disabled = false;
      DOM.btnSaveEdit.textContent = 'Save';
    });
  }

  // --- AUTOCOMPLETE SUGGESTIONS HANDLERS ---
  function showAutocompleteSuggestions(inputEl, suggestionsContainerEl, type, list) {
    const query = inputEl.value.trim().toLowerCase();
    
    // If query is empty, hide suggestions
    if (!query) {
      suggestionsContainerEl.innerHTML = '';
      suggestionsContainerEl.style.display = 'none';
      return;
    }
    
    // Filter the items from unique lists
    // Filter out duplicates that are already in editingData[type]
    const currentItems = type === 'people' ? editingData.people : editingData.tags;
    const items = list.filter(item => {
      const isAlreadyAdded = currentItems.some(existing => existing.toLowerCase() === item.toLowerCase());
      const matchesQuery = item.toLowerCase().includes(query);
      return !isAlreadyAdded && matchesQuery;
    });
    
    if (items.length === 0) {
      suggestionsContainerEl.innerHTML = '';
      suggestionsContainerEl.style.display = 'none';
      return;
    }
    
    // Render suggestions
    suggestionsContainerEl.innerHTML = '';
    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'suggestion-item';
      div.textContent = item;
      div.addEventListener('click', () => {
        // Add item
        if (type === 'people') {
          editingData.people.push(item);
          renderEditPills('people', DOM.editPeopleList, editingData.people);
        } else {
          editingData.tags.push(item.toLowerCase());
          renderEditPills('tags', DOM.editTagsList, editingData.tags);
        }
        // Reset and hide suggestions
        inputEl.value = '';
        suggestionsContainerEl.innerHTML = '';
        suggestionsContainerEl.style.display = 'none';
        inputEl.focus();
      });
      suggestionsContainerEl.appendChild(div);
    });
    
    suggestionsContainerEl.style.display = 'block';
  }

  function hideAllAutocompleteSuggestions() {
    if (DOM.addPersonSuggestions) {
      DOM.addPersonSuggestions.innerHTML = '';
      DOM.addPersonSuggestions.style.display = 'none';
    }
    if (DOM.addTagSuggestions) {
      DOM.addTagSuggestions.innerHTML = '';
      DOM.addTagSuggestions.style.display = 'none';
    }
  }

  // --- ERROR STATE HANDLING ---
  function showErrorState(message) {
    DOM.galleryGrid.innerHTML = `
      <div class="empty-state" id="error-state" style="border-color: var(--accent-terracotta);">
        <h3 style="color: var(--accent-terracotta);">Initialization Error</h3>
        <p>${message}</p>
        <div style="margin-top: 20px; font-size: 0.9rem; text-align: left; background: #fff; padding: 15px; border-radius: 8px; border: 1px solid var(--border-light)">
          <strong>Quick fix steps for developers:</strong>
          <ol style="margin-left: 20px; margin-top: 8px;">
            <li>Open a terminal in the project directory.</li>
            <li>Run <code>python optimize_photos.py</code> to compress slides and generate the file database.</li>
            <li>Refresh this page.</li>
          </ol>
        </div>
      </div>
    `;
    DOM.currentCount.textContent = '0';
    DOM.totalCount.textContent = '0';
  }
});
