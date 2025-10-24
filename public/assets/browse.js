import { supabase } from '../supabaseConfig.js';

const messListingsContainer = document.getElementById('messListings');
const loadingIndicator = document.getElementById('loadingMesses');
const searchCollegeInput = document.getElementById('searchCollege');
const searchLocationInput = document.getElementById('searchLocation');
const maxPriceInput = document.getElementById('maxPrice');

let allMesses = []; // To store fetched data

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Function to render mess cards
function renderMesses(messes) {
    messListingsContainer.innerHTML = ''; // Clear previous listings
    if (!messes || messes.length === 0) {
        messListingsContainer.innerHTML = '<p class="text-center text-gray-500 col-span-full">No messes found matching your criteria.</p>';
        return;
    }

    messes.forEach(mess => {
        const card = document.createElement('div');
        card.className = 'bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition flex flex-col justify-between';
        card.setAttribute('data-aos', 'fade-up');

        let plansHtml = '<p class="text-sm text-gray-500 mt-2">No plans available.</p>';
        if (mess.plans && mess.plans.length > 0) {
             mess.plans.sort((a, b) => a.price - b.price);
            plansHtml = '<ul class="mt-2 space-y-1 text-sm">';
            mess.plans.forEach(plan => {
                plansHtml += `<li class="flex justify-between"><span>${plan.name} (${plan.duration_days} days)</span> <span class="font-semibold">₹${plan.price}</span></li>`;
            });
            plansHtml += '</ul>';
        }

        card.innerHTML = `
            <div>
                <h3 class="text-xl font-bold text-gray-800 mb-2">${mess.mess_name || 'Unnamed Mess'}</h3>
                <p class="text-sm text-gray-600 mb-1"><span class="font-semibold">College:</span> ${mess.nearby_college || 'N/A'}</p>
                <p class="text-sm text-gray-600 mb-1"><span class="font-semibold">Contact:</span> ${mess.email || 'N/A'}</p>
                ${mess.location_link ? `<a href="${mess.location_link}" target="_blank" rel="noopener noreferrer" class="text-sm text-blue-600 hover:underline inline-block mb-3">View Location</a>` : '<p class="text-sm text-gray-400 mb-3">Location not provided</p>'}
                <h4 class="text-md font-semibold text-gray-700 mt-3 border-t pt-2">Available Plans:</h4>
                ${plansHtml}
            </div>
             <a href="register.html?mess_id=${mess.mess_id}" class="mt-4 block text-center bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition">
                Register Here
            </a>
        `;
        messListingsContainer.appendChild(card);
    });
    
    if (typeof AOS !== 'undefined') {
        AOS.refresh();
    }
}

// Function to filter messes based on input
const filterMesses = debounce(() => {
    const collegeQuery = searchCollegeInput.value.toLowerCase().trim();
    const locationQuery = searchLocationInput.value.toLowerCase().trim();
    const maxPrice = parseFloat(maxPriceInput.value);

    const filtered = allMesses.filter(mess => {
        const collegeMatch = !collegeQuery || (mess.nearby_college && mess.nearby_college.toLowerCase().includes(collegeQuery));
        const locationMatch = !locationQuery; // Location search is complex, can be improved later
        
        const priceMatch = isNaN(maxPrice) || !mess.plans || mess.plans.length === 0 || mess.plans.some(plan => plan.price <= maxPrice);

        return collegeMatch && locationMatch && priceMatch;
    });

    renderMesses(filtered);
}, 300);

// Initial data fetch (Corrected Logic)
async function fetchAllMesses() {
    loadingIndicator.style.display = 'block';
    messListingsContainer.innerHTML = '';

    try {
        // Step 1: Fetch all mess info
        const { data: messInfos, error: messInfoError } = await supabase.from('mess_info').select('*');
        if (messInfoError) throw messInfoError;

        // Step 2: Fetch all plans
        const { data: allPlans, error: plansError } = await supabase.from('plans').select('*');
        if (plansError) throw plansError;
        
        // Step 3: Combine the data
        allMesses = messInfos.map(mess => {
            return {
                ...mess,
                // Filter and attach the plans that belong to this mess
                plans: allPlans.filter(plan => plan.mess_id === mess.mess_id)
            };
        });

        renderMesses(allMesses);

    } catch (err) {
        console.error('Error fetching messes:', err);
        messListingsContainer.innerHTML = '<p class="text-center text-red-500 col-span-full">Could not load messes. Please try again later.</p>';
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

// Add event listeners for filters
searchCollegeInput.addEventListener('input', filterMesses);
searchLocationInput.addEventListener('input', filterMesses);
maxPriceInput.addEventListener('input', filterMesses);

// Load data when the page loads
document.addEventListener('DOMContentLoaded', fetchAllMesses);