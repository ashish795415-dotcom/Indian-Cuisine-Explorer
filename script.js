// script.js - Updated with improved instructions UI logic

const SPOONACULAR_API_KEY = '96da5da953ad4dfe8357dd3f03d0e39b'; // Replace with your free Spoonacular API key

// Get references to HTML elements
const searchButton = document.getElementById('searchButton');
const randomButton = document.getElementById('randomButton');
const searchInput = document.getElementById('searchInput');
const resultsContainer = document.getElementById('results-container');
const modal = document.getElementById('recipe-modal');
const modalContent = document.getElementById('recipe-details-content');
const closeModalButton = document.getElementById('closeModalButton');
const loadingSpinner = document.getElementById('loading');
const themeToggle = document.getElementById('themeToggle');

// All recipes from APIs
let allRecipes = [];

// --- DARK MODE THEME TOGGLE LOGIC ---
const icon = themeToggle.querySelector('i');

// Function to apply theme
const applyTheme = (theme) => {
    if (theme === 'dark') {
        document.body.classList.add('dark');
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    } else {
        document.body.classList.remove('dark');
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
    }
};

// Check for saved theme in local storage
const savedTheme = localStorage.getItem('theme') || 'light';
applyTheme(savedTheme);

// Event listener for theme toggle button
themeToggle.addEventListener('click', () => {
    const isDark = document.body.classList.contains('dark');
    const newTheme = isDark ? 'light' : 'dark';
    applyTheme(newTheme);
    localStorage.setItem('theme', newTheme);
});
// --- END OF THEME TOGGLE LOGIC ---


// Load recipes when the page loads
window.addEventListener('DOMContentLoaded', async() => {
    loadingSpinner.classList.remove('hidden');
    try {
        // Fetch from TheMealDB
        const mealDbResponse = await fetch('https://www.themealdb.com/api/json/v1/1/filter.php?a=Indian');
        const mealDbData = await mealDbResponse.json();
        const mealDbMeals = mealDbData.meals || [];

        const mealDbRecipes = await Promise.all(mealDbMeals.map(async(meal) => {
            const detailResponse = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${meal.idMeal}`);
            const detailData = await detailResponse.json();
            const fullMeal = detailData.meals[0];
            fullMeal.apiSource = 'mealdb';
            return fullMeal;
        }));

        // Fetch from Spoonacular (50 Indian recipes)
        const spoonacularResponse = await fetch(`https://api.spoonacular.com/recipes/complexSearch?cuisine=indian&number=50&apiKey=${SPOONACULAR_API_KEY}`);
        const spoonacularData = await spoonacularResponse.json();
        const spoonacularMeals = spoonacularData.results || [];

        const spoonacularRecipes = await Promise.all(spoonacularMeals.map(async(meal) => {
            const detailResponse = await fetch(`https://api.spoonacular.com/recipes/${meal.id}/information?apiKey=${SPOONACULAR_API_KEY}`);
            const detailData = await detailResponse.json();
            detailData.apiSource = 'spoonacular';
            detailData.strMeal = detailData.title;
            detailData.strMealThumb = detailData.image;
            detailData.strInstructions = detailData.instructions;
            // Map ingredients
            detailData.ingredients = detailData.extendedIngredients.map(ing => ({
                ingredient: ing.name,
                measure: ing.originalString
            }));
            return detailData;
        }));

        // Merge unique by name
        const combined = [...mealDbRecipes, ...spoonacularRecipes];
        const uniqueMap = new Map();
        combined.forEach(recipe => {
            const nameLower = recipe.strMeal.toLowerCase();
            if (!uniqueMap.has(nameLower)) {
                uniqueMap.set(nameLower, recipe);
            }
        });
        allRecipes = Array.from(uniqueMap.values());

        displayRecipes(allRecipes);
    } catch (error) {
        console.error('Error fetching recipes:', error);
        resultsContainer.innerHTML = '<p>Failed to load recipes. Check API keys and try again.</p>';
    } finally {
        loadingSpinner.classList.add('hidden');
    }
});

// Event Listeners
searchButton.addEventListener('click', () => {
    const query = searchInput.value.trim().toLowerCase();
    searchRecipes(query);
});

searchInput.addEventListener('keydown', (event) => {
    if (event.key === "Enter") {
        const query = searchInput.value.trim().toLowerCase();
        searchRecipes(query);
    }
});

randomButton.addEventListener('click', getRandomRecipe);

// Search for recipes
function searchRecipes(query) {
    const searchResults = allRecipes.filter(recipe => {
        const titleMatch = recipe.strMeal.toLowerCase().includes(query);
        let ingredientMatch = false;
        if (recipe.apiSource === 'mealdb') {
            for (let i = 1; i <= 20; i++) {
                const ingredient = recipe[`strIngredient${i}`];
                if (ingredient && ingredient.toLowerCase().includes(query)) {
                    ingredientMatch = true;
                    break;
                }
            }
        } else if (recipe.apiSource === 'spoonacular') {
            ingredientMatch = recipe.ingredients.some(ing => ing.ingredient.toLowerCase().includes(query));
        }
        return titleMatch || ingredientMatch;
    });

    displayRecipes(searchResults);
}

// Display recipes in the grid
function displayRecipes(recipes) {
    resultsContainer.innerHTML = '';
    if (recipes.length === 0) {
        resultsContainer.innerHTML = '<p>No recipes found. Try another search!</p>';
        return;
    }

    recipes.forEach(recipe => {
        const recipeCard = document.createElement('div');
        recipeCard.className = 'recipe-card';
        recipeCard.innerHTML = `
            <img src="${recipe.strMealThumb}" alt="${recipe.strMeal}">
            <h3>${recipe.strMeal}</h3>
        `;
        recipeCard.addEventListener('click', () => showRecipeDetails(recipe));
        resultsContainer.appendChild(recipeCard);
    });
}

// Show recipe details in modal
function showRecipeDetails(recipe) {
    // Format ingredients list
    let ingredientsHTML = '';
    if (recipe.apiSource === 'mealdb') {
        for (let i = 1; i <= 20; i++) {
            const ingredient = recipe[`strIngredient${i}`];
            const measure = recipe[`strMeasure${i}`];
            if (ingredient) {
                ingredientsHTML += `<li>${measure} ${ingredient}</li>`;
            } else {
                break;
            }
        }
    } else if (recipe.apiSource === 'spoonacular') {
        ingredientsHTML = recipe.ingredients.map(ing => `<li>${ing.measure}</li>`).join('');
    }

    // *** THIS IS THE NEW PART FOR INSTRUCTIONS ***
    // Process instructions text into a numbered list
    let instructionsHTML = '<p>No instructions provided.</p>';
    if (recipe.strInstructions) {
        const steps = recipe.strInstructions.split(/\r?\n/).filter(step => step.trim() !== '');
        if (steps.length > 0) {
            instructionsHTML = `
                <ol class="instruction-steps">
                    ${steps.map(step => `<li>${step}</li>`).join('')}
                </ol>
            `;
        }
    }

    modalContent.innerHTML = `
        <h2>${recipe.strMeal}</h2>
        <div class="recipe-details-layout">
            <div class="recipe-image-container">
                <img src="${recipe.strMealThumb}" alt="${recipe.strMeal}">
            </div>
            <div class="recipe-info-container">
                <h3>Ingredients:</h3>
                <ul>${ingredientsHTML}</ul>
                <h3>Instructions:</h3>
                ${instructionsHTML}
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
}

// Get random recipe
function getRandomRecipe() {
    if (allRecipes.length === 0) return;
    const randomIndex = Math.floor(Math.random() * allRecipes.length);
    const randomRecipe = allRecipes[randomIndex];
    showRecipeDetails(randomRecipe);
}

// Close modal
closeModalButton.addEventListener('click', () => {
    modal.classList.add('hidden');
});