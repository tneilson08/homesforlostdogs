const searchForm = document.querySelector('#search-form');
const searchArea = document.getElementById('result-text');
const dogProfile = document.getElementById('dog-profile');
const resultText = document.querySelector('#result-text');
const dogsEl = document.querySelector('#results');
const pageResults = document.querySelector('#page-results');
const pageResultsTop = document.querySelector('#page-results-top');
const paginationContainers = [pageResultsTop, pageResults];

const API_KEY = '8wgvVMFc';
const API_BASE = 'https://api.rescuegroups.org/v5';

let currentPage = 1;
let totalPages = 0;
let currentZip = '';
let currentDistance = '';

function isValidUSZip(zip) {
	return /^\d{5}(-\d{4})?$/.test(zip);
}

function headers() {
	return {
		Authorization: API_KEY,
		'Content-Type': 'application/vnd.api+json'
	};
}

function textTruncate(str = '', length = 100, ending = '...') {
	return str.length > length
		? str.substring(0, length - ending.length) + ending
		: str;
}

function findIncluded(data, type, id) {
	return data.included?.find(item => {
		return item.type === type && String(item.id) === String(id);
	});
}

function getFirstPicture(dog, data, size = 'small') {
	const pictureRel = dog.relationships?.pictures?.data?.[0];

	if (!pictureRel) {
		return 'img/photo-placeholder.png';
	}

	const picture = data.included?.find(item => {
		return item.type === 'pictures' && item.id === pictureRel.id;
	});

	return (
		picture?.attributes?.[size]?.url ||
		picture?.attributes?.[size] ||
		picture?.attributes?.large?.url ||
		picture?.attributes?.large ||
		picture?.attributes?.original?.url ||
		picture?.attributes?.original ||
		'img/photo-placeholder.png'
	);
}

function getLocation(dog, data) {
	const locationRel = dog.relationships?.locations?.data?.[0];

	if (!locationRel) {
		return {};
	}

	return findIncluded(data, 'locations', locationRel.id)?.attributes || {};
}

function getOrg(dog, data) {
	const orgRel = dog.relationships?.orgs?.data?.[0];

	if (!orgRel) {
		return {};
	}

	return findIncluded(data, 'orgs', orgRel.id)?.attributes || {};
}

function yesNo(value, yesText, noText) {
	if (value === true) return yesText;
	if (value === false) return noText;
	return 'Ask for info';
}

async function fetchDogs(page = 1) {
	const url = `${API_BASE}/public/animals/search/available/dogs/?page=${page}&limit=24&include=pictures,locations,orgs`;

	const body = {
		data: {
			filterRadius: {
				postalcode: currentZip,
				miles: Number(currentDistance)
			}
		}
	};

	const res = await fetch(url, {
		method: 'POST',
		headers: headers(),
		body: JSON.stringify(body)
	});

	const text = await res.text();

	if (!res.ok) {
		console.error('RescueGroups raw error:', text);
		throw new Error(`RescueGroups error: ${res.status}`);
	}

	if (!text) {
		console.error('RescueGroups returned an empty response');
		throw new Error('Empty response from RescueGroups');
	}

	return JSON.parse(text);
}

async function getDogs(e) {
	if (e) e.preventDefault();

	const zip = document.querySelector('#zip').value.trim();
	const distance = document.getElementById('distance').value;

	currentPage = 1;
	currentZip = zip;
	currentDistance = distance;

	if (!isValidUSZip(zip)) {
		searchArea.innerHTML = 'Please enter a valid zip code';
		dogProfile.innerHTML = '';
		dogsEl.innerHTML = '';
		pageResults.style.display = 'none';
		return;
	}

	if (distance === '') {
		searchArea.innerHTML = 'Please enter a distance';
		dogsEl.innerHTML = '';
		pageResults.style.display = 'none';
		return;
	}

	if (Number(distance) > 500) {
		searchArea.innerHTML = "Distance can't be greater than 500 miles";
		dogsEl.innerHTML = '';
		pageResults.style.display = 'none';
		return;
	}

	try {
		searchArea.innerHTML = 'Searching...';
		dogsEl.innerHTML = '';
		dogProfile.innerHTML = '';
		pageResults.style.display = 'none';

		const data = await fetchDogs(currentPage);

		totalPages = data.meta?.pages || 0;

		const totalCount = (
			data.meta?.count ||
			data.meta?.countReturned ||
			data.data?.length ||
			0
		).toLocaleString('en-US');

		showDogs(data);

		if (data.data && data.data.length > 0) {
			searchArea.innerHTML = `Found ${totalCount} dogs near ${zip}!`;
		}
	} catch (err) {
		console.error(err);
		searchArea.innerHTML = 'Something went wrong fetching dogs.';
		dogsEl.innerHTML = '';
		pageResults.style.display = 'none';
	}
}

function showDogs(data) {
	dogsEl.innerHTML = '';
	dogProfile.innerHTML = '';

	const animals = data.data || [];

	if (animals.length === 0) {
		searchArea.innerHTML = 'No dogs were found. Try adjusting the distance.';
		pageResults.style.display = 'none';
		return;
	}

	animals.forEach(dog => {
		const attrs = dog.attributes || {};
		const thumbnail = getFirstPicture(dog, data, 'large');

		const dogResult = document.createElement('div');
		dogResult.classList.add('dog-result');

		dogResult.innerHTML = `
      <div class="dog-pro" data-dogid="${dog.id}" data-photo="${thumbnail}">
        <div class="thumb-photo-box">
          <img class="thumbnail-result" src="${thumbnail}" alt="${attrs.name || 'Dog photo'}">
        </div>
        <div class="info-result">
          <p class="result-name">${textTruncate(attrs.name || 'Unknown', 20)}</p>
          <p class="result-other-info">${attrs.breedPrimary || attrs.breedString || 'Breed unknown'}</p>
          <p class="result-other-info">${attrs.distance ? Math.floor(attrs.distance) + ' miles away' : 'Distance unavailable'}</p>
        </div>
      </div>
    `;

		dogsEl.appendChild(dogResult);
	});

	renderPagination();
	resultText.scrollIntoView(true);
}

function renderPagination() {
	paginationContainers.forEach(container => {
		renderPaginationInto(container);
	});
}

function renderPaginationInto(container) {
	container.innerHTML = '';

	if (totalPages <= 1) {
		container.style.display = 'none';
		return;
	}

	container.style.display = 'flex';

	const icons = {
		singleLeft: `
      <svg class="pagination-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15 5L8 12L15 19Z"></path>
      </svg>
    `,
		singleRight: `
      <svg class="pagination-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 5L16 12L9 19Z"></path>
      </svg>
    `,
		doubleLeft: `
      <svg class="pagination-icon pagination-icon-double" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M11 5L4 12L11 19Z"></path>
        <path d="M20 5L13 12L20 19Z"></path>
      </svg>
    `,
		doubleRight: `
      <svg class="pagination-icon pagination-icon-double" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M13 5L20 12L13 19Z"></path>
        <path d="M4 5L11 12L4 19Z"></path>
      </svg>
    `
	};

	const createButton = ({ label, page, className = '', icon = null }) => {
		const button = document.createElement('button');

		button.className = `pagination-btn ${className}`;
		button.type = 'button';
		button.setAttribute('aria-label', label);

		if (icon) {
			button.innerHTML = icon;
		} else {
			button.textContent = page;
		}

		if (page === currentPage && !icon) {
			button.classList.add('active');
			button.disabled = true;
		}

		button.addEventListener('click', () => {
			goToPage(page);
		});

		return button;
	};

	container.appendChild(
		createButton({
			label: 'First page',
			page: 1,
			className: 'pagination-first',
			icon: icons.doubleLeft
		})
	);

	container.appendChild(
		createButton({
			label: 'Previous page',
			page: Math.max(currentPage - 1, 1),
			className: 'pagination-prev',
			icon: icons.singleLeft
		})
	);

	const startPage = Math.floor((currentPage - 1) / 3) * 3 + 1;
	const endPage = Math.min(startPage + 2, totalPages);

	for (let page = startPage; page <= endPage; page++) {
		container.appendChild(
			createButton({
				label: `Page ${page}`,
				page
			})
		);
	}

	container.appendChild(
		createButton({
			label: 'Next page',
			page: Math.min(currentPage + 1, totalPages),
			className: 'pagination-next',
			icon: icons.singleRight
		})
	);

	container.appendChild(
		createButton({
			label: 'Last page',
			page: totalPages,
			className: 'pagination-last',
			icon: icons.doubleRight
		})
	);

	const firstBtn = container.querySelector('.pagination-first');
	const prevBtn = container.querySelector('.pagination-prev');
	const nextBtn = container.querySelector('.pagination-next');
	const lastBtn = container.querySelector('.pagination-last');

	if (currentPage === 1) {
		firstBtn.disabled = true;
		prevBtn.disabled = true;
		firstBtn.classList.add('disabled');
		prevBtn.classList.add('disabled');
	}

	if (currentPage === totalPages) {
		nextBtn.disabled = true;
		lastBtn.disabled = true;
		nextBtn.classList.add('disabled');
		lastBtn.classList.add('disabled');
	}
}

async function goToPage(page) {
	if (page < 1 || page > totalPages || page === currentPage) return;

	currentPage = page;

	try {
		searchArea.innerHTML = `Loading page ${currentPage}...`;

		const data = await fetchDogs(currentPage);
		showDogs(data);

		searchArea.innerHTML = `Page ${currentPage} of ${totalPages}`;
	} catch (err) {
		console.error(err);
		searchArea.innerHTML = 'Something went wrong loading that page.';
	}
}

// async function nextPage() {
//   if (currentPage >= totalPages) return;

//   currentPage++;

//   try {
//     searchArea.innerHTML = 'Loading next page...';

//     const data = await fetchDogs(currentPage);
//     showDogs(data);

//     searchArea.innerHTML = `Page ${currentPage} of ${totalPages}`;
//   } catch (err) {
//     console.error(err);
//     searchArea.innerHTML = 'Something went wrong loading the next page.';
//   }
// }

// async function previousPage() {
//   if (currentPage <= 1) return;

//   currentPage--;

//   try {
//     searchArea.innerHTML = 'Loading previous page...';

//     const data = await fetchDogs(currentPage);
//     showDogs(data);

//     searchArea.innerHTML = `Page ${currentPage} of ${totalPages}`;
//   } catch (err) {
//     console.error(err);
//     searchArea.innerHTML = 'Something went wrong loading the previous page.';
//   }
// }

async function getDogByID(dogID, photoFromSearch) {
	const url = `${API_BASE}/public/animals/${dogID}?include=pictures,locations,orgs,breeds,colors`;

	try {
		const res = await fetch(url, {
			method: 'GET',
			headers: headers()
		});

		if (!res.ok) {
			const errorData = await res.json();
			console.error('RescueGroups API error:', errorData);
			throw new Error(`RescueGroups error: ${res.status}`);
		}

		const data = await res.json();

		console.log('FULL DOG RESPONSE:', data);
		console.log('DOG ATTRIBUTES:', data.data.attributes);
		console.log('DOG RELATIONSHIPS:', data.data.relationships);
		console.log('INCLUDED DATA:', data.included);

		addDogToDOM(data.data[0], data, photoFromSearch);
	} catch (err) {
		console.error(err);
		searchArea.innerHTML = 'Something went wrong loading this dog profile.';
	}
}

function getBreed(dog, data) {
	const breedRels = dog.relationships?.breeds?.data || [];

	if (breedRels.length === 0) {
		return dog.attributes?.breedPrimary || dog.attributes?.breedString || 'Breed unknown';
	}

	const breeds = breedRels
		.map(breedRel => findIncluded(data, 'breeds', breedRel.id)?.attributes?.name)
		.filter(Boolean);

	return breeds.length ? breeds.join(' / ') : 'Breed unknown';
}

function getColor(dog, data) {
	const colorRels = dog.relationships?.colors?.data || [];

	if (colorRels.length === 0) {
		return dog.attributes?.colorDetails || 'Contact for info';
	}

	const colors = colorRels
		.map(colorRel => findIncluded(data, 'colors', colorRel.id)?.attributes?.name)
		.filter(Boolean);

	return colors.length ? colors.join(' / ') : 'Contact for info';
}

function addDogToDOM(dog, data, photoFromSearch) {
	const attrs = dog.attributes || {};
	console.log('DOG NAME:', attrs.name);
	const location = getLocation(dog, data);
	const org = getOrg(dog, data);
	const breed = getBreed(dog, data);

	const dogPhotos = getDogPhotos(data);
	let currentPhotoIndex = 0;

	if (photoFromSearch && !dogPhotos.includes(photoFromSearch)) {
		dogPhotos.unshift(photoFromSearch);
	}
	const thumbnail = photoFromSearch || getFirstPicture(dog, data, 'original');

	const name = attrs.name || 'Unknown';
	const gender = attrs.sex || attrs.gender || 'Unknown';
	const age = attrs.ageGroup || attrs.ageString || attrs.age || 'Unknown';
	const size = attrs.sizeGroup || attrs.sizeCurrent || attrs.size || 'Unknown';
	const color = getColor(dog, data);

	const city = location.city || org.city || '';
	const state = location.state || org.state || '';

	const locationText = city || state
		? `${city}${state ? ', ' + state : ''}`
		: 'Location unavailable';

	dogProfile.innerHTML = `
    <section class="modal-container">
      <div class="dog-modal">
        <div class="dog-profile-intro">
          <div class="photo-section">
            <div class="photo-container">
              <img
                id="profile-photo"
                class="profile-photo"
                src="${thumbnail}"
                alt="${name}"
                onerror="this.src='img/photo-placeholder.png';"
              >
            </div>
 
            <div class="photo-controls">
              <button id="prev-photo" class="photo-arrow" disabled>◀</button>
              <button id="next-photo" class="photo-arrow">▶</button>
            </div>
          </div>
 
          <div class="profile-info-section">
            <h1 id="profile-name" class="profile-name">${attrs.name || 'Unknown'}</h1>
            <br>
 
            <img class="breed-icon" src="img/breed-icon.svg" alt="">
            <p id="profile-breed" class="attributes">${breed}</p>
            <br>
 
            <img class="location-icon" src="img/location-icon.svg" alt="">
            <p id="profile-location" class="attributes">${locationText}</p>
            <br><br>
 
            <p class="attributes attr-addt">Gender: ${gender}</p>
            <p class="attributes attr-addt">Age: ${age}</p>
            <p class="attributes attr-addt">Size: ${size}</p>
            <p class="attributes attr-addt">Colors: ${color}</p>
          </div>
        </div>
 
        <div class="about-info-section">
          <div class="about-info">
            <h2 class="about-title">Personality</h2>
            <img class="personality-icon" src="img/personality-icon.svg">
 
            <p class="about-text">
              ${attrs.isKidsOk === true
			? 'I\'m good with children'
			: attrs.isKidsOk === false
				? 'I\'m not good with children'
				: 'Ask how I am with children'
		}
            </p>
            <p class="about-text">
              ${attrs.isDogsOk === true
			? 'I\'m good with other dogs'
			: attrs.isDogsOk === false
				? 'I\'m not good with other dogs'
				: 'Ask how I am with other dogs'
		}
            </p>
            <p class="about-text">
              ${attrs.isCatsOk === true
			? 'I\'m good with cats'
			: attrs.isCatsOk === false
				? 'I\'m not good with cats'
				: 'Ask how I am with cats'
		}
            </p>
 
            <br>
 
            <h2 class="about-title">Health</h2>
            <img class="health-icon" src="img/health-icon.svg">
 
            <p class="about-text">
              ${attrs.isAltered === true
			? 'I\'m spayed/neutered'
			: attrs.isAltered === false
				? 'I\'m not spayed/neutered'
				: "Ask if I'm spayed/neutered"
		}
            </p>
            <p class="about-text">
              ${attrs.isCurrentVaccinations === true
			? 'My shots are current'
			: attrs.isCurrentVaccinations === false
				? 'My shots are not current'
				: "Ask if my shots are current"
		}
            </p>
            <p class="about-text">
              ${attrs.isSpecialNeeds === true
			? 'I have special needs'
			: attrs.isSpecialNeeds === false
				? 'I do not have special needs'
				: "Ask if I have special needs"
		}
            </p>
          </div>
 
          <div class="contact-info">
            <h2 class="contact-title">Reach Out</h2>
            <img class="house-icon" src="img/house-icon.svg">
 
            <p class="contact-text">${org.email || ''}</p>
            <p class="contact-text">${location.phone || org.phone || ''}</p>
            <p class="contact-text">${location.street || org.street || ''}</p>
            <p class="contact-text">
              ${location.city || org.city || ''}${location.state || org.state ? ',' : ''} ${location.state || org.state || ''} ${location.postalcode || org.postalcode || ''}
            </p>
 
            ${attrs.url
			? `<p class="contact-text"><a href="${attrs.url}" target="_blank" rel="noopener">View adoption page</a></p>`
			: ''
		}
          </div>
        </div>
 
        <div class="single-btn-container">
          <button id="return-search" class="return-search">Return to Search</button>
        </div>
      </div>
    </section>
  `;

	document.body.style.overflow = 'hidden';

	const profilePhoto = document.getElementById('profile-photo');
	const prevPhotoBtn = document.getElementById('prev-photo');
	const nextPhotoBtn = document.getElementById('next-photo');

	function updatePhotoButtons() {
		prevPhotoBtn.disabled = currentPhotoIndex === 0;
		nextPhotoBtn.disabled = currentPhotoIndex === dogPhotos.length - 1;
	}

	prevPhotoBtn.addEventListener('click', () => {
		if (currentPhotoIndex > 0) {
			currentPhotoIndex--;
			profilePhoto.src = dogPhotos[currentPhotoIndex];
			updatePhotoButtons();
		}
	});

	nextPhotoBtn.addEventListener('click', () => {
		if (currentPhotoIndex < dogPhotos.length - 1) {
			currentPhotoIndex++;
			profilePhoto.src = dogPhotos[currentPhotoIndex];
			updatePhotoButtons();
		}
	});

	updatePhotoButtons();

	profilePhoto.addEventListener('click', openFullscreenPhoto);

	function openFullscreenPhoto() {
		const viewer = document.createElement('div');
		viewer.className = 'fullscreen-photo-viewer';

		viewer.innerHTML = `
    <button id="close-fullscreen" class="close-fullscreen" aria-label="Close full-size photo">
      <svg class="close-fullscreen-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>
    <img id="fullscreen-photo" class="fullscreen-photo" src="${dogPhotos[currentPhotoIndex]}" alt="${name}">
    <div class="fullscreen-arrow-controls">
      <button id="fullscreen-prev" class="fullscreen-arrow" type="button">◀</button>
      <button id="fullscreen-next" class="fullscreen-arrow" type="button">▶</button>
    </div>
  `;

		document.body.appendChild(viewer);

		const fullscreenPhoto = document.getElementById('fullscreen-photo');
		const closeFullscreen = document.getElementById('close-fullscreen');
		const fullscreenPrev = document.getElementById('fullscreen-prev');
		const fullscreenNext = document.getElementById('fullscreen-next');

		function updateFullscreenPhoto() {
			fullscreenPhoto.src = dogPhotos[currentPhotoIndex];
			profilePhoto.src = dogPhotos[currentPhotoIndex];

			fullscreenPrev.disabled = currentPhotoIndex === 0;
			fullscreenNext.disabled = currentPhotoIndex === dogPhotos.length - 1;

			updatePhotoButtons();
		}

		function closeFullscreenViewer() {
			viewer.remove();
			document.removeEventListener('keydown', handleFullscreenKeys);
		}

		function handleFullscreenKeys(e) {
			if (e.key === 'Escape') {
				closeFullscreenViewer();
			}

			if (e.key === 'ArrowLeft' && currentPhotoIndex > 0) {
				currentPhotoIndex--;
				updateFullscreenPhoto();
			}

			if (e.key === 'ArrowRight' && currentPhotoIndex < dogPhotos.length - 1) {
				currentPhotoIndex++;
				updateFullscreenPhoto();
			}
		}

		closeFullscreen.addEventListener('click', closeFullscreenViewer);

		fullscreenPrev.addEventListener('click', () => {
			if (currentPhotoIndex > 0) {
				currentPhotoIndex--;
				updateFullscreenPhoto();
			}
		});

		fullscreenNext.addEventListener('click', () => {
			if (currentPhotoIndex < dogPhotos.length - 1) {
				currentPhotoIndex++;
				updateFullscreenPhoto();
			}
		});

		document.addEventListener('keydown', handleFullscreenKeys);

		updateFullscreenPhoto();
	}

	function handleEsc(e) {
		if (e.key === 'Escape') {
			dogProfile.innerHTML = '';
			document.body.style.overflow = 'visible';
			document.removeEventListener('keydown', handleEsc);
		}
	}

	document.addEventListener('keydown', handleEsc);

	document.getElementById('return-search').addEventListener('click', () => {
		dogProfile.innerHTML = '';
		document.body.style.overflow = 'visible';
		document.removeEventListener('keydown', handleEsc);
	});
}

searchForm.addEventListener('submit', getDogs);

dogsEl.addEventListener('click', e => {
	const dogProfileInfo = e.target.closest('.dog-pro');

	if (dogProfileInfo) {
		const dogID = dogProfileInfo.getAttribute('data-dogid');
		const photo = dogProfileInfo.getAttribute('data-photo');
		getDogByID(dogID, photo);
	}
});

function getDogPhotos(data) {
	return (data.included || [])
		.filter(item => item.type === 'pictures')
		.sort((a, b) => (a.attributes?.order || 0) - (b.attributes?.order || 0))
		.map(pic =>
			pic.attributes?.large?.url ||
			pic.attributes?.original?.url
		)
		.filter(Boolean);
}
