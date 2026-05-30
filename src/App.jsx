import { useState, useMemo } from "react";

const TDEE_BASE = 2360;
const SWIM_BONUS = 600;
const WALK_BONUS = 350;

const foods = [
  // ─── MALAYSIAN MAINS ───
  { cat: "🇲🇾 Malaysian Mains", icon: "🍛", name: "Nasi Lemak (full set)", cal: 850, note: "Rice + sambal + egg + ikan bilis", traffic: "red" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🍚", name: "Nasi Goreng (1 plate)", cal: 600, note: "High oil + rice", traffic: "red" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🍚", name: "Nasi Campur (with rice)", cal: 700, note: "Depends on lauk — skip rice", traffic: "red" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🍚", name: "Nasi Briyani (1 plate)", cal: 700, note: "High rice + ghee", traffic: "red" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🍚", name: "Nasi Dagang", cal: 550, note: "Coconut rice + fish curry", traffic: "red" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🍚", name: "Nasi Kerabu", cal: 500, note: "Blue rice — still rice", traffic: "red" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🍚", name: "Claypot Chicken Rice", cal: 650, note: "Rice base — limit portions", traffic: "red" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🍛", name: "Banana Leaf Rice (full)", cal: 800, note: "Skip the rice refills", traffic: "red" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🫓", name: "Roti Canai (1 piece)", cal: 300, note: "Skip curry gravy", traffic: "yellow" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🫓", name: "Roti Telur (1 piece)", cal: 380, note: "Egg inside adds protein", traffic: "yellow" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🫓", name: "Roti Tisu (1 piece)", cal: 420, note: "Mostly sugar + flour", traffic: "red" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🫓", name: "Roti Sardin (1 piece)", cal: 350, note: "Sardine filling adds protein", traffic: "yellow" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🫓", name: "Tosai (1 piece)", cal: 200, note: "Better than roti canai", traffic: "yellow" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🫓", name: "Idli (2 pieces)", cal: 150, note: "Steamed — good choice", traffic: "green" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🍲", name: "Bak Kut Teh (pork rib soup)", cal: 320, note: "High protein, low carb", traffic: "green" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🍲", name: "Tom Yam (1 bowl)", cal: 200, note: "Excellent — low cal, high flavor", traffic: "green" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🍲", name: "Tom Yam with glass noodles", cal: 380, note: "Noodles add carbs", traffic: "yellow" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🍲", name: "Sup Kambing (1 bowl)", cal: 280, note: "Good protein, skip bread", traffic: "green" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🍲", name: "Sup Tulang (1 bowl)", cal: 300, note: "Nutritious — skip rice", traffic: "green" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🍲", name: "Sup Ekor / Oxtail Soup", cal: 350, note: "High collagen, skip rice", traffic: "yellow" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🥘", name: "Chicken Rendang (100g)", cal: 230, note: "Protein rich, eat without rice", traffic: "yellow" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🥘", name: "Beef Rendang (100g)", cal: 260, note: "Good if no rice", traffic: "yellow" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🥘", name: "Ayam Masak Merah (100g)", cal: 200, note: "Eat the chicken, skip gravy rice", traffic: "yellow" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🥘", name: "Ayam Goreng (1 piece)", cal: 250, note: "Remove skin = better", traffic: "yellow" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🥘", name: "Ikan Bakar (100g)", cal: 180, note: "Grilled fish — great choice", traffic: "green" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🥘", name: "Dhal Curry (100g)", cal: 120, note: "Good protein + fiber", traffic: "green" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🥗", name: "Yong Tau Foo (5 pcs soup)", cal: 200, note: "Choose soup version always", traffic: "green" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🥗", name: "Chee Cheong Fun (plain)", cal: 280, note: "High refined carb", traffic: "yellow" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🥗", name: "Rojak (1 plate)", cal: 250, note: "Watch the sweet sauce", traffic: "yellow" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🍢", name: "Satay Chicken (1 stick)", cal: 45, note: "Great protein snack", traffic: "green" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🍢", name: "Satay Beef (1 stick)", cal: 55, note: "Protein win", traffic: "green" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🍢", name: "Satay sauce (2 tbsp)", cal: 100, note: "Limit — high sugar", traffic: "yellow" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🥗", name: "Kerabu Mangga (1 serve)", cal: 130, note: "Mango salad — tangy and light", traffic: "green" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🍲", name: "Mee Rebus (1 plate)", cal: 480, note: "Starchy sweet gravy", traffic: "red" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🍲", name: "Mee Siam (1 plate)", cal: 400, note: "Tangy but high carb", traffic: "yellow" },
  { cat: "🇲🇾 Malaysian Mains", icon: "🍲", name: "Nasi Putih (1 cup cooked)", cal: 206, note: "White rice — skip where possible", traffic: "red" },

  // ─── NOODLES & PASTA ───
  { cat: "🍜 Noodles & Pasta", icon: "🍜", name: "Kuey Teow Soup (1 bowl)", cal: 350, note: "OK — choose soup over dry", traffic: "yellow" },
  { cat: "🍜 Noodles & Pasta", icon: "🍜", name: "Kuey Teow ¼ plate", cal: 180, note: "Your usual breakfast portion — fine", traffic: "green" },
  { cat: "🍜 Noodles & Pasta", icon: "🍜", name: "Char Kuey Teow (1 plate)", cal: 500, note: "High oil, max once a week", traffic: "red" },
  { cat: "🍜 Noodles & Pasta", icon: "🍜", name: "Bihun Soup (1 bowl)", cal: 300, note: "Better than fried versions", traffic: "yellow" },
  { cat: "🍜 Noodles & Pasta", icon: "🍜", name: "Bihun Goreng (1 plate)", cal: 480, note: "Fried version — higher oil", traffic: "red" },
  { cat: "🍜 Noodles & Pasta", icon: "🍜", name: "Laksa Lemak (1 bowl)", cal: 500, note: "Coconut milk — heavy", traffic: "yellow" },
  { cat: "🍜 Noodles & Pasta", icon: "🍜", name: "Asam Laksa (1 bowl)", cal: 380, note: "Better than lemak version", traffic: "yellow" },
  { cat: "🍜 Noodles & Pasta", icon: "🍜", name: "Curry Mee (1 bowl)", cal: 520, note: "High coconut milk", traffic: "red" },
  { cat: "🍜 Noodles & Pasta", icon: "🍜", name: "Wonton Mee Soup", cal: 380, note: "Soup version OK", traffic: "yellow" },
  { cat: "🍜 Noodles & Pasta", icon: "🍜", name: "Pan Mee Soup", cal: 420, note: "Add egg for protein", traffic: "yellow" },
  { cat: "🍜 Noodles & Pasta", icon: "🍜", name: "Hokkien Mee (1 plate)", cal: 550, note: "High oil + thick noodles", traffic: "red" },
  { cat: "🍜 Noodles & Pasta", icon: "🍜", name: "Prawn Mee (1 bowl)", cal: 420, note: "High protein broth", traffic: "yellow" },
  { cat: "🍜 Noodles & Pasta", icon: "🍜", name: "Beef Noodles (1 bowl)", cal: 480, note: "Good protein source", traffic: "yellow" },
  { cat: "🍜 Noodles & Pasta", icon: "🍜", name: "Mee Goreng (1 plate)", cal: 660, note: "High sugar + oil", traffic: "red" },
  { cat: "🍜 Noodles & Pasta", icon: "🍜", name: "Maggi Goreng (1 plate)", cal: 550, note: "Instant noodle base — avoid", traffic: "red" },
  { cat: "🍜 Noodles & Pasta", icon: "🍜", name: "Instant Noodles cooked (1 pack)", cal: 380, note: "High sodium, zero protein", traffic: "red" },
  { cat: "🍜 Noodles & Pasta", icon: "🍜", name: "Loh Mee (1 bowl)", cal: 450, note: "Starchy gravy", traffic: "yellow" },
  { cat: "🍜 Noodles & Pasta", icon: "🍜", name: "Duck Noodles Soup", cal: 450, note: "Good flavour, moderate carb", traffic: "yellow" },
  { cat: "🍜 Noodles & Pasta", icon: "🍜", name: "Ipoh Hor Fun (1 bowl)", cal: 380, note: "Silky noodles in broth", traffic: "yellow" },
  { cat: "🍜 Noodles & Pasta", icon: "🍝", name: "Carbonara (1 bowl)", cal: 800, note: "Adjust full day around this", traffic: "yellow" },
  { cat: "🍜 Noodles & Pasta", icon: "🍝", name: "Spaghetti Bolognese", cal: 650, note: "Protein from meat saves it", traffic: "yellow" },
  { cat: "🍜 Noodles & Pasta", icon: "🍝", name: "Aglio Olio (1 plate)", cal: 550, note: "Simple + lower cal pasta", traffic: "yellow" },
  { cat: "🍜 Noodles & Pasta", icon: "🍝", name: "Mac & Cheese (1 bowl)", cal: 700, note: "Refined carb + fat bomb", traffic: "red" },
  { cat: "🍜 Noodles & Pasta", icon: "🍜", name: "Pad Thai (1 plate)", cal: 550, note: "High sugar in sauce", traffic: "red" },
  { cat: "🍜 Noodles & Pasta", icon: "🍜", name: "Phở Beef (1 bowl)", cal: 400, note: "Good protein, watch noodle portion", traffic: "yellow" },
  { cat: "🍜 Noodles & Pasta", icon: "🍝", name: "Pasta Marinara (1 plate)", cal: 480, note: "Tomato base better than cream", traffic: "yellow" },

  // ─── PROTEINS ───
  { cat: "🥩 Proteins", icon: "🍗", name: "Chicken Breast grilled (100g)", cal: 165, note: "Best protein source", traffic: "green" },
  { cat: "🥩 Proteins", icon: "🍗", name: "Chicken Thigh grilled (100g)", cal: 209, note: "Fattier but still good", traffic: "green" },
  { cat: "🥩 Proteins", icon: "🍗", name: "Chicken Wing fried (1 pc)", cal: 120, note: "Remove skin = better", traffic: "yellow" },
  { cat: "🥩 Proteins", icon: "🥩", name: "Beef lean (100g)", cal: 215, note: "High protein", traffic: "green" },
  { cat: "🥩 Proteins", icon: "🥩", name: "Lamb (100g)", cal: 260, note: "Higher fat — limit", traffic: "yellow" },
  { cat: "🥩 Proteins", icon: "🥩", name: "Pork lean (100g)", cal: 190, note: "Good protein", traffic: "green" },
  { cat: "🥩 Proteins", icon: "🐟", name: "White fish fillet (100g)", cal: 90, note: "Best lean protein", traffic: "green" },
  { cat: "🥩 Proteins", icon: "🐟", name: "Salmon grilled (100g)", cal: 208, note: "Omega-3 rich · USDA verified", traffic: "green" },
  { cat: "🥩 Proteins", icon: "🐟", name: "Tuna canned in water (100g)", cal: 126, note: "Cheapest lean protein · USDA verified", traffic: "green" },
  { cat: "🥩 Proteins", icon: "🐟", name: "Tuna canned in oil (100g)", cal: 190, note: "Drain oil first", traffic: "green" },
  { cat: "🥩 Proteins", icon: "🦐", name: "Prawns / Shrimp (100g)", cal: 99, note: "Very lean protein", traffic: "green" },
  { cat: "🥩 Proteins", icon: "🦑", name: "Squid (100g)", cal: 92, note: "Grilled only — not fried", traffic: "green" },
  { cat: "🥩 Proteins", icon: "🦪", name: "Clams / Siput (100g)", cal: 74, note: "Very lean, high iron", traffic: "green" },
  { cat: "🥩 Proteins", icon: "🦀", name: "Crab (100g)", cal: 87, note: "Excellent lean protein", traffic: "green" },
  { cat: "🥩 Proteins", icon: "🐟", name: "Mackerel / Ikan Kembung (100g)", cal: 158, note: "Omega-3, cheap", traffic: "green" },
  { cat: "🥩 Proteins", icon: "🐠", name: "Tilapia (100g)", cal: 96, note: "Very lean white fish", traffic: "green" },
  { cat: "🥩 Proteins", icon: "🐟", name: "Sardine canned (100g)", cal: 208, note: "High omega-3 + protein", traffic: "green" },
  { cat: "🥩 Proteins", icon: "🥚", name: "Whole Egg (1)", cal: 78, note: "Perfect food", traffic: "green" },
  { cat: "🥩 Proteins", icon: "🥚", name: "Egg White (1)", cal: 17, note: "Pure protein", traffic: "green" },
  { cat: "🥩 Proteins", icon: "🥚", name: "Hard Boiled Egg (1)", cal: 78, note: "Best snack", traffic: "green" },
  { cat: "🥩 Proteins", icon: "🧊", name: "Tofu firm (100g)", cal: 76, note: "Great plant protein", traffic: "green" },
  { cat: "🥩 Proteins", icon: "🧊", name: "Tofu silken (100g)", cal: 55, note: "Lower cal, softer", traffic: "green" },
  { cat: "🥩 Proteins", icon: "🟫", name: "Tempeh (100g)", cal: 193, note: "Fermented — excellent", traffic: "green" },
  { cat: "🥩 Proteins", icon: "🫘", name: "Chickpeas cooked (100g)", cal: 164, note: "Protein + fiber", traffic: "green" },
  { cat: "🥩 Proteins", icon: "🫘", name: "Lentils cooked (100g)", cal: 116, note: "High fiber protein", traffic: "green" },
  { cat: "🥩 Proteins", icon: "🫘", name: "Edamame (100g)", cal: 121, note: "Complete protein, great snack", traffic: "green" },

  // ─── VEGETABLES ───
  { cat: "🥦 Vegetables", icon: "🥦", name: "Broccoli (100g)", cal: 35, note: "Eat freely", traffic: "green" },
  { cat: "🥦 Vegetables", icon: "🥦", name: "Cauliflower (100g)", cal: 25, note: "Eat freely", traffic: "green" },
  { cat: "🥦 Vegetables", icon: "🥬", name: "Spinach / Bayam (100g)", cal: 23, note: "Eat freely", traffic: "green" },
  { cat: "🥦 Vegetables", icon: "🥬", name: "Kangkung (100g)", cal: 30, note: "Stir fry with minimal oil", traffic: "green" },
  { cat: "🥦 Vegetables", icon: "🥬", name: "Cabbage (100g)", cal: 25, note: "Free food", traffic: "green" },
  { cat: "🥦 Vegetables", icon: "🥕", name: "Carrot (100g)", cal: 41, note: "Good fiber", traffic: "green" },
  { cat: "🥦 Vegetables", icon: "🥒", name: "Cucumber (100g)", cal: 16, note: "Unlimited snack", traffic: "green" },
  { cat: "🥦 Vegetables", icon: "🍅", name: "Tomato (1 medium)", cal: 22, note: "Eat freely", traffic: "green" },
  { cat: "🥦 Vegetables", icon: "🍄", name: "Mushroom Button (100g)", cal: 22, note: "Great umami, low cal", traffic: "green" },
  { cat: "🥦 Vegetables", icon: "🍄", name: "Mushroom Shiitake (100g)", cal: 34, note: "Anti-inflammatory", traffic: "green" },
  { cat: "🥦 Vegetables", icon: "🌱", name: "Beansprouts (100g)", cal: 30, note: "Eat freely", traffic: "green" },
  { cat: "🥦 Vegetables", icon: "🫘", name: "Long Bean (100g)", cal: 47, note: "Good fiber", traffic: "green" },
  { cat: "🥦 Vegetables", icon: "🟢", name: "Okra / Lady Finger (100g)", cal: 33, note: "Great for blood sugar", traffic: "green" },
  { cat: "🥦 Vegetables", icon: "🍆", name: "Eggplant / Terung (100g)", cal: 25, note: "Low cal, versatile", traffic: "green" },
  { cat: "🥦 Vegetables", icon: "🟢", name: "Bitter Gourd (100g)", cal: 17, note: "Blood sugar control", traffic: "green" },
  { cat: "🥦 Vegetables", icon: "🌽", name: "Corn (100g)", cal: 86, note: "Higher carb — moderate", traffic: "yellow" },
  { cat: "🥦 Vegetables", icon: "🧅", name: "Onion (100g)", cal: 40, note: "Cooking base — fine", traffic: "green" },
  { cat: "🥦 Vegetables", icon: "🧄", name: "Garlic (1 clove)", cal: 4, note: "Anti-inflammatory", traffic: "green" },
  { cat: "🥦 Vegetables", icon: "🫑", name: "Bell Pepper (100g)", cal: 31, note: "Vitamin C rich", traffic: "green" },
  { cat: "🥦 Vegetables", icon: "🥑", name: "Avocado (100g)", cal: 160, note: "Healthy fat — limit to ½", traffic: "yellow" },
  { cat: "🥦 Vegetables", icon: "🍠", name: "Sweet Potato (100g)", cal: 90, note: "Better carb choice", traffic: "yellow" },
  { cat: "🥦 Vegetables", icon: "🥔", name: "White Potato boiled (100g)", cal: 87, note: "OK boiled, not fried", traffic: "yellow" },
  { cat: "🥦 Vegetables", icon: "🟡", name: "Pumpkin / Labu (100g)", cal: 26, note: "Very low cal", traffic: "green" },
  { cat: "🥦 Vegetables", icon: "🌿", name: "Pucuk Paku (fern shoots, 100g)", cal: 28, note: "Malaysian veg, low cal", traffic: "green" },

  // ─── FRUITS ───
  { cat: "🍎 Fruits", icon: "🍎", name: "Apple (1 medium)", cal: 95, note: "Great snack", traffic: "green" },
  { cat: "🍎 Fruits", icon: "🍌", name: "Banana (1 medium)", cal: 105, note: "Post-workout only", traffic: "yellow" },
  { cat: "🍎 Fruits", icon: "🍊", name: "Orange (1 medium)", cal: 62, note: "Good vitamin C", traffic: "green" },
  { cat: "🍎 Fruits", icon: "🥭", name: "Mango (100g)", cal: 60, note: "Limit — high sugar fruit", traffic: "yellow" },
  { cat: "🍎 Fruits", icon: "🍈", name: "Papaya (100g)", cal: 43, note: "Great morning fruit", traffic: "green" },
  { cat: "🍎 Fruits", icon: "🍉", name: "Watermelon (100g)", cal: 30, note: "High water, low cal", traffic: "green" },
  { cat: "🍎 Fruits", icon: "🍐", name: "Guava (100g)", cal: 68, note: "High fiber, good choice", traffic: "green" },
  { cat: "🍎 Fruits", icon: "⚫", name: "Durian (100g)", cal: 147, note: "High sugar + fat — limit strictly", traffic: "red" },
  { cat: "🍎 Fruits", icon: "🔴", name: "Rambutan (5 pieces)", cal: 45, note: "High sugar — limit", traffic: "yellow" },
  { cat: "🍎 Fruits", icon: "⚪", name: "Longan (100g)", cal: 60, note: "Moderate sugar", traffic: "yellow" },
  { cat: "🍎 Fruits", icon: "⭐", name: "Starfruit (1 medium)", cal: 28, note: "Very low cal", traffic: "green" },
  { cat: "🍎 Fruits", icon: "🐉", name: "Dragon Fruit (100g)", cal: 60, note: "Low cal, good fiber", traffic: "green" },
  { cat: "🍎 Fruits", icon: "🍍", name: "Pineapple (100g)", cal: 50, note: "Anti-inflammatory", traffic: "green" },
  { cat: "🍎 Fruits", icon: "🟡", name: "Jackfruit / Nangka (100g)", cal: 95, note: "High sugar — limit", traffic: "yellow" },
  { cat: "🍎 Fruits", icon: "🍓", name: "Strawberry (100g)", cal: 32, note: "Low sugar fruit", traffic: "green" },
  { cat: "🍎 Fruits", icon: "🍇", name: "Grapes (100g)", cal: 69, note: "High sugar — limit", traffic: "yellow" },
  { cat: "🍎 Fruits", icon: "🥝", name: "Kiwi (1 medium)", cal: 61, note: "High vitamin C", traffic: "green" },
  { cat: "🍎 Fruits", icon: "🫐", name: "Blueberries (100g)", cal: 57, note: "Antioxidant powerhouse", traffic: "green" },
  { cat: "🍎 Fruits", icon: "🍑", name: "Mangosteen (100g)", cal: 63, note: "Antioxidant rich", traffic: "green" },
  { cat: "🍎 Fruits", icon: "🟤", name: "Dates (1 piece)", cal: 23, note: "High sugar — limit to 2-3", traffic: "yellow" },
  { cat: "🍎 Fruits", icon: "🟠", name: "Ciku / Sapodilla (100g)", cal: 83, note: "Sweet tropical fruit — limit", traffic: "yellow" },
  { cat: "🍎 Fruits", icon: "🟤", name: "Tamarind / Asam (1 tbsp)", cal: 48, note: "Used in cooking", traffic: "yellow" },

  // ─── DRINKS ───
  { cat: "🥤 Drinks", icon: "💧", name: "Plain Water", cal: 0, note: "Minimum 3L daily — critical on Mounjaro", traffic: "green" },
  { cat: "🥤 Drinks", icon: "☕", name: "Black Coffee (no sugar)", cal: 5, note: "Boosts fat burning", traffic: "green" },
  { cat: "🥤 Drinks", icon: "🍵", name: "Teh O Kosong", cal: 5, note: "Fine", traffic: "green" },
  { cat: "🥤 Drinks", icon: "☕", name: "Kopi O Kosong", cal: 10, note: "Fine", traffic: "green" },
  { cat: "🥤 Drinks", icon: "🍵", name: "Green Tea (no sugar)", cal: 2, note: "Boosts metabolism", traffic: "green" },
  { cat: "🥤 Drinks", icon: "🍵", name: "Chamomile Tea (no sugar)", cal: 2, note: "Good before sleep", traffic: "green" },
  { cat: "🥤 Drinks", icon: "🥛", name: "Coconut Water (250ml)", cal: 45, note: "Good electrolytes post-swim", traffic: "green" },
  { cat: "🥤 Drinks", icon: "🌿", name: "Air Barley (no sugar)", cal: 20, note: "Cooling drink, low cal", traffic: "green" },
  { cat: "🥤 Drinks", icon: "🍋", name: "Air Limau (no sugar, 250ml)", cal: 20, note: "Good choice", traffic: "green" },
  { cat: "🥤 Drinks", icon: "🥛", name: "Almond Milk unsweetened (250ml)", cal: 40, note: "Good milk alternative", traffic: "green" },
  { cat: "🥤 Drinks", icon: "🥛", name: "Soy Milk unsweetened (250ml)", cal: 80, note: "Good protein content", traffic: "green" },
  { cat: "🥤 Drinks", icon: "🥛", name: "Low Fat Milk (250ml)", cal: 102, note: "Good calcium", traffic: "green" },
  { cat: "🥤 Drinks", icon: "🥛", name: "Full Cream Milk (250ml)", cal: 150, note: "Higher fat", traffic: "yellow" },
  { cat: "🥤 Drinks", icon: "🍵", name: "Teh Tarik Kurang Manis", cal: 120, note: "Ask for less sugar always", traffic: "yellow" },
  { cat: "🥤 Drinks", icon: "🍵", name: "Teh Tarik Normal", cal: 180, note: "High sugar", traffic: "red" },
  { cat: "🥤 Drinks", icon: "☕", name: "Kopi Tarik", cal: 160, note: "High condensed milk", traffic: "red" },
  { cat: "🥤 Drinks", icon: "🍫", name: "Milo Kurang Manis (1 cup)", cal: 130, note: "Better option", traffic: "yellow" },
  { cat: "🥤 Drinks", icon: "🍫", name: "Milo Normal (1 cup)", cal: 200, note: "High sugar", traffic: "red" },
  { cat: "🥤 Drinks", icon: "🍫", name: "Neslo (Milo + Coffee)", cal: 220, note: "High sugar", traffic: "red" },
  { cat: "🥤 Drinks", icon: "🧃", name: "Fresh Orange Juice (250ml)", cal: 110, note: "No fiber, high sugar", traffic: "yellow" },
  { cat: "🥤 Drinks", icon: "🍋", name: "Air Limau Manis (250ml)", cal: 120, note: "High sugar — ask no sugar", traffic: "red" },
  { cat: "🥤 Drinks", icon: "🌸", name: "Bandung (250ml)", cal: 120, note: "Sugar + milk combo", traffic: "red" },
  { cat: "🥤 Drinks", icon: "🌸", name: "Sirap (250ml)", cal: 150, note: "Pure sugar syrup", traffic: "red" },
  { cat: "🥤 Drinks", icon: "🧋", name: "Bubble Tea (500ml)", cal: 400, note: "Worst drink on the list", traffic: "red" },
  { cat: "🥤 Drinks", icon: "🧊", name: "Cendol (1 bowl)", cal: 350, note: "Sugar overload", traffic: "red" },
  { cat: "🥤 Drinks", icon: "🧊", name: "ABC / Ais Kacang (1 bowl)", cal: 400, note: "Sugar + condensed milk", traffic: "red" },
  { cat: "🥤 Drinks", icon: "🧃", name: "100 Plus (330ml)", cal: 140, note: "Liquid sugar", traffic: "red" },
  { cat: "🥤 Drinks", icon: "🥤", name: "Coca Cola (330ml)", cal: 139, note: "Pure sugar — avoid", traffic: "red" },
  { cat: "🥤 Drinks", icon: "🥤", name: "Pepsi (330ml)", cal: 150, note: "Pure sugar — avoid", traffic: "red" },
  { cat: "🥤 Drinks", icon: "🥤", name: "Sprite / 7Up (330ml)", cal: 140, note: "Sugar + gas", traffic: "red" },
  { cat: "🥤 Drinks", icon: "⚡", name: "Red Bull (250ml)", cal: 110, note: "High sugar + caffeine", traffic: "red" },
  { cat: "🥤 Drinks", icon: "🍺", name: "Beer (330ml)", cal: 150, note: "Liquid carbs — avoid", traffic: "red" },
  { cat: "🥤 Drinks", icon: "🍷", name: "Red Wine (150ml glass)", cal: 125, note: "Occasional only", traffic: "yellow" },
  { cat: "🥤 Drinks", icon: "🥃", name: "Whisky / Spirits (30ml)", cal: 70, note: "No mixer = lower cal", traffic: "yellow" },

  // ─── FAST FOOD ───
  { cat: "🍔 Fast Food", icon: "🍔", name: "McD Big Mac", cal: 550, note: "Double beef high cal", traffic: "red" },
  { cat: "🍔 Fast Food", icon: "🍔", name: "McD Quarter Pounder", cal: 530, note: "High cal burger", traffic: "red" },
  { cat: "🍔 Fast Food", icon: "🐟", name: "McD Filet-O-Fish", cal: 380, note: "Lower option at McD", traffic: "yellow" },
  { cat: "🍔 Fast Food", icon: "🍗", name: "McD McChicken", cal: 400, note: "Skip the bun if possible", traffic: "yellow" },
  { cat: "🍔 Fast Food", icon: "🍗", name: "McD McNuggets (6 pcs)", cal: 280, note: "Moderate, no sauce", traffic: "yellow" },
  { cat: "🍔 Fast Food", icon: "🍟", name: "McD Large Fries", cal: 490, note: "Empty calories", traffic: "red" },
  { cat: "🍔 Fast Food", icon: "🍟", name: "McD Medium Fries", cal: 380, note: "Still high", traffic: "red" },
  { cat: "🍔 Fast Food", icon: "🍟", name: "McD Small Fries", cal: 230, note: "Better but still fried", traffic: "red" },
  { cat: "🍔 Fast Food", icon: "🍗", name: "KFC Original Chicken (1 pc)", cal: 320, note: "Remove skin = ~200 cal", traffic: "yellow" },
  { cat: "🍔 Fast Food", icon: "🍔", name: "KFC Zinger Burger", cal: 490, note: "High cal", traffic: "red" },
  { cat: "🍔 Fast Food", icon: "🥔", name: "KFC Whipped Potato", cal: 120, note: "Moderate side", traffic: "yellow" },
  { cat: "🍔 Fast Food", icon: "🥗", name: "KFC Coleslaw", cal: 170, note: "High mayo — skip", traffic: "yellow" },
  { cat: "🍔 Fast Food", icon: "🍔", name: "Burger King Whopper", cal: 650, note: "Very high cal", traffic: "red" },
  { cat: "🍔 Fast Food", icon: "🍔", name: "Burger King Chicken Royale", cal: 550, note: "High cal chicken burger", traffic: "red" },
  { cat: "🍔 Fast Food", icon: "🌭", name: "A&W Coney Dog", cal: 400, note: "Processed meat + bun", traffic: "red" },
  { cat: "🍔 Fast Food", icon: "🍕", name: "Pizza 1 slice (cheese)", cal: 250, note: "1-2 slices OK", traffic: "yellow" },
  { cat: "🍔 Fast Food", icon: "🍕", name: "Pizza 1 slice (pepperoni)", cal: 300, note: "High sodium + fat", traffic: "yellow" },
  { cat: "🍔 Fast Food", icon: "🥖", name: "Subway 6\" Turkey", cal: 280, note: "Best fast food option", traffic: "green" },
  { cat: "🍔 Fast Food", icon: "🥖", name: "Subway 6\" BMT", cal: 450, note: "High sodium", traffic: "yellow" },
  { cat: "🍔 Fast Food", icon: "🍔", name: "Ramly Burger (basic)", cal: 450, note: "Malaysian street burger", traffic: "red" },
  { cat: "🍔 Fast Food", icon: "🍔", name: "Ramly Burger Special", cal: 600, note: "Egg + sauce adds calories", traffic: "red" },
  { cat: "🍔 Fast Food", icon: "🌮", name: "Taco Bell Crunchy Taco", cal: 170, note: "Reasonable single taco", traffic: "yellow" },
  { cat: "🍔 Fast Food", icon: "🍗", name: "Texas Chicken (1 pc)", cal: 330, note: "Similar to KFC", traffic: "yellow" },

  // ─── MALAYSIAN SNACKS ───
  { cat: "🍿 Malaysian Snacks", icon: "🟠", name: "Super Ring (1 pack 60g)", cal: 310, note: "⚠️ Zero protein, zero benefit — avoid!", traffic: "red" },
  { cat: "🍿 Malaysian Snacks", icon: "🟡", name: "Cheetos (1 pack 60g)", cal: 320, note: "Corn puff trap — you know better", traffic: "red" },
  { cat: "🍿 Malaysian Snacks", icon: "🟡", name: "Twisties (1 pack 60g)", cal: 290, note: "Addictive — avoid buying", traffic: "red" },
  { cat: "🍿 Malaysian Snacks", icon: "🍜", name: "Mamee Monster (1 pack)", cal: 230, note: "Dry instant noodle snack", traffic: "red" },
  { cat: "🍿 Malaysian Snacks", icon: "🔴", name: "Keropok Lekor fried (5 pcs)", cal: 200, note: "High starch + oil", traffic: "red" },
  { cat: "🍿 Malaysian Snacks", icon: "🔴", name: "Keropok Lekor steamed (5 pcs)", cal: 120, note: "Much better option than fried", traffic: "yellow" },
  { cat: "🍿 Malaysian Snacks", icon: "🌀", name: "Muruku (30g)", cal: 150, note: "Deep fried lentil flour", traffic: "red" },
  { cat: "🍿 Malaysian Snacks", icon: "🟢", name: "Kuih Kaswi (1 piece)", cal: 80, note: "Moderate", traffic: "yellow" },
  { cat: "🍿 Malaysian Snacks", icon: "🟦", name: "Kuih Talam (1 piece)", cal: 120, note: "Coconut + rice flour", traffic: "yellow" },
  { cat: "🍿 Malaysian Snacks", icon: "🟣", name: "Kuih Lapis (1 piece)", cal: 90, note: "Rice starch layers", traffic: "yellow" },
  { cat: "🍿 Malaysian Snacks", icon: "🟢", name: "Ondeh Ondeh (3 pcs)", cal: 150, note: "Pandan + palm sugar", traffic: "yellow" },
  { cat: "🍿 Malaysian Snacks", icon: "🟤", name: "Kuih Bahulu (3 pcs)", cal: 130, note: "Egg sponge cake", traffic: "yellow" },
  { cat: "🍿 Malaysian Snacks", icon: "🟤", name: "Kuih Serimuka (1 piece)", cal: 130, note: "Glutinous rice base", traffic: "yellow" },
  { cat: "🍿 Malaysian Snacks", icon: "⚪", name: "Putu Piring (3 pcs)", cal: 150, note: "Rice flour + coconut", traffic: "yellow" },
  { cat: "🍿 Malaysian Snacks", icon: "🍌", name: "Pisang Goreng (1 pc)", cal: 130, note: "Fried banana — limit", traffic: "yellow" },
  { cat: "🍿 Malaysian Snacks", icon: "🍤", name: "Cucur Udang (1 pc)", cal: 80, note: "Moderate if small", traffic: "yellow" },
  { cat: "🍿 Malaysian Snacks", icon: "🟤", name: "Vadai (1 piece)", cal: 150, note: "Deep fried lentil", traffic: "yellow" },
  { cat: "🍿 Malaysian Snacks", icon: "🥟", name: "Karipap (1 piece)", cal: 160, note: "Curry puff — fried pastry", traffic: "yellow" },
  { cat: "🍿 Malaysian Snacks", icon: "🥟", name: "Karipap baked (1 piece)", cal: 130, note: "Baked version — better", traffic: "yellow" },
  { cat: "🍿 Malaysian Snacks", icon: "🌯", name: "Popiah Basah (1 roll)", cal: 180, note: "Fresh roll — OK choice", traffic: "yellow" },
  { cat: "🍿 Malaysian Snacks", icon: "🌯", name: "Popiah Goreng (1 roll)", cal: 210, note: "Fried version — higher", traffic: "yellow" },
  { cat: "🍿 Malaysian Snacks", icon: "🟤", name: "Aiskrim Potong (1 stick)", cal: 120, note: "Lower cal than cone", traffic: "yellow" },
  { cat: "🍿 Malaysian Snacks", icon: "🌾", name: "Rempeyek (5 pieces)", cal: 140, note: "Fried peanut cracker", traffic: "red" },

  // ─── INTERNATIONAL SNACKS ───
  { cat: "🍭 Int'l Snacks & Sweets", icon: "⚫", name: "Oreo (3 cookies)", cal: 160, note: "High sugar + refined flour", traffic: "red" },
  { cat: "🍭 Int'l Snacks & Sweets", icon: "🍫", name: "Kit Kat (1 bar 45g)", cal: 230, note: "Sugar + wafer", traffic: "red" },
  { cat: "🍭 Int'l Snacks & Sweets", icon: "🍫", name: "Snickers (1 bar 52g)", cal: 250, note: "High sugar + fat", traffic: "red" },
  { cat: "🍭 Int'l Snacks & Sweets", icon: "🍫", name: "Cadbury Dairy Milk (50g)", cal: 265, note: "High sugar chocolate", traffic: "red" },
  { cat: "🍭 Int'l Snacks & Sweets", icon: "🍫", name: "Dark Chocolate 70%+ (20g)", cal: 120, note: "Best chocolate choice if needed", traffic: "yellow" },
  { cat: "🍭 Int'l Snacks & Sweets", icon: "🥔", name: "Pringles (serving 30g)", cal: 160, note: "Don't open the tube", traffic: "red" },
  { cat: "🍭 Int'l Snacks & Sweets", icon: "🍪", name: "Ritz Crackers (5 pcs)", cal: 80, note: "Low nutrition snack", traffic: "red" },
  { cat: "🍭 Int'l Snacks & Sweets", icon: "🍪", name: "Marie Biscuit (3 pcs)", cal: 90, note: "High sugar content", traffic: "red" },
  { cat: "🍭 Int'l Snacks & Sweets", icon: "🍪", name: "Digestive Biscuit (2 pcs)", cal: 140, note: "Not as healthy as it sounds", traffic: "red" },
  { cat: "🍭 Int'l Snacks & Sweets", icon: "🍦", name: "Ice Cream (1 scoop 100g)", cal: 200, note: "Occasional only", traffic: "red" },
  { cat: "🍭 Int'l Snacks & Sweets", icon: "🍦", name: "Magnum Ice Cream (1 bar)", cal: 280, note: "High fat + sugar", traffic: "red" },
  { cat: "🍭 Int'l Snacks & Sweets", icon: "🍬", name: "Gummy Bears (30g)", cal: 108, note: "Pure sugar", traffic: "red" },
  { cat: "🍭 Int'l Snacks & Sweets", icon: "🍮", name: "Pudding / Jelly (100g)", cal: 80, note: "Lower cal dessert option", traffic: "yellow" },
  { cat: "🍭 Int'l Snacks & Sweets", icon: "🫙", name: "Nutella (1 tbsp 15g)", cal: 80, note: "Mostly sugar + palm oil", traffic: "red" },

  // ─── BAKERY & BREAD ───
  { cat: "🥐 Bakery & Bread", icon: "🍞", name: "White Bread (1 slice)", cal: 80, note: "Refined carb — avoid", traffic: "red" },
  { cat: "🥐 Bakery & Bread", icon: "🍞", name: "Wholegrain Bread (1 slice)", cal: 90, note: "Better option if needed", traffic: "yellow" },
  { cat: "🥐 Bakery & Bread", icon: "🥐", name: "Croissant", cal: 280, note: "Butter + flour bomb", traffic: "red" },
  { cat: "🥐 Bakery & Bread", icon: "🎂", name: "Chocolate Cake (1 slice)", cal: 350, note: "Special occasions only", traffic: "red" },
  { cat: "🥐 Bakery & Bread", icon: "🎂", name: "Cheesecake (1 slice)", cal: 400, note: "High fat + sugar", traffic: "red" },
  { cat: "🥐 Bakery & Bread", icon: "🍩", name: "Glazed Donut (1)", cal: 250, note: "Fried + sugar glaze", traffic: "red" },
  { cat: "🥐 Bakery & Bread", icon: "🧁", name: "Blueberry Muffin", cal: 460, note: "More sugar than cake", traffic: "red" },
  { cat: "🥐 Bakery & Bread", icon: "🍰", name: "Banana Cake (1 slice)", cal: 280, note: "High sugar + flour", traffic: "red" },
  { cat: "🥐 Bakery & Bread", icon: "🍞", name: "Kaya Toast set (full)", cal: 450, note: "White bread + kaya sugar", traffic: "red" },
  { cat: "🥐 Bakery & Bread", icon: "🍞", name: "Roti Kahwin (2 slices)", cal: 200, note: "Kaya + butter = sugar + fat", traffic: "red" },
  { cat: "🥐 Bakery & Bread", icon: "🫓", name: "Garlic Bread (1 slice)", cal: 200, note: "Butter + white bread", traffic: "red" },

  // ─── BREAKFAST ───
  { cat: "🌅 Breakfast", icon: "🥣", name: "Rolled Oats (40g dry)", cal: 148, note: "Best morning carb", traffic: "green" },
  { cat: "🌅 Breakfast", icon: "🥣", name: "Oats with milk (full bowl)", cal: 280, note: "Sustaining breakfast", traffic: "green" },
  { cat: "🌅 Breakfast", icon: "🥣", name: "Overnight Oats (1 jar)", cal: 300, note: "Great prep-ahead option", traffic: "green" },
  { cat: "🌅 Breakfast", icon: "🥣", name: "Granola (50g)", cal: 220, note: "Check label for added sugar", traffic: "yellow" },
  { cat: "🌅 Breakfast", icon: "🟫", name: "Weetabix (2 biscuits)", cal: 130, note: "Simple and clean", traffic: "green" },
  { cat: "🌅 Breakfast", icon: "🟡", name: "Cornflakes (30g, no sugar)", cal: 110, note: "OK, add protein", traffic: "yellow" },
  { cat: "🌅 Breakfast", icon: "🥚", name: "Scrambled Eggs (2 eggs)", cal: 200, note: "Best breakfast protein", traffic: "green" },
  { cat: "🌅 Breakfast", icon: "🥗", name: "Greek Yogurt nonfat plain (150g)", cal: 97, note: "High protein · USDA verified", traffic: "green" },
  { cat: "🌅 Breakfast", icon: "🥗", name: "Greek Yogurt full-fat plain (150g)", cal: 150, note: "Creamier, more fat · USDA", traffic: "green" },
  { cat: "🌅 Breakfast", icon: "🫐", name: "Greek Yogurt with berries (200g)", cal: 170, note: "Excellent breakfast", traffic: "green" },
  { cat: "🌅 Breakfast", icon: "🥞", name: "Pancakes (2 medium)", cal: 360, note: "High refined flour", traffic: "red" },
  { cat: "🌅 Breakfast", icon: "🧇", name: "Waffles (1 piece)", cal: 290, note: "Refined flour + syrup", traffic: "red" },
  { cat: "🌅 Breakfast", icon: "🍳", name: "Full English Breakfast", cal: 800, note: "Eggs + beans + sausage + toast", traffic: "red" },

  // ─── NUTS & SEEDS ───
  { cat: "🥜 Nuts & Seeds", icon: "🌰", name: "Almonds (30g)", cal: 173, note: "Don't exceed 30g at a time", traffic: "green" },
  { cat: "🥜 Nuts & Seeds", icon: "🟤", name: "Walnuts (30g)", cal: 196, note: "Omega-3 rich", traffic: "green" },
  { cat: "🥜 Nuts & Seeds", icon: "🟡", name: "Cashews (30g)", cal: 163, note: "Higher carb nut", traffic: "yellow" },
  { cat: "🥜 Nuts & Seeds", icon: "🟤", name: "Peanuts (30g)", cal: 166, note: "Good protein snack", traffic: "green" },
  { cat: "🥜 Nuts & Seeds", icon: "⚪", name: "Sunflower Seeds (30g)", cal: 164, note: "Good magnesium", traffic: "green" },
  { cat: "🥜 Nuts & Seeds", icon: "🟢", name: "Pumpkin Seeds (30g)", cal: 163, note: "High zinc", traffic: "green" },
  { cat: "🥜 Nuts & Seeds", icon: "⚪", name: "Macadamia Nuts (30g)", cal: 204, note: "Highest fat nut — limit", traffic: "yellow" },
  { cat: "🥜 Nuts & Seeds", icon: "🟤", name: "Peanut Butter natural (1 tbsp)", cal: 95, note: "Natural PB only, 1 tbsp max", traffic: "yellow" },
  { cat: "🥜 Nuts & Seeds", icon: "⚫", name: "Chia Seeds (1 tbsp 15g)", cal: 70, note: "High fiber + omega-3", traffic: "green" },
  { cat: "🥜 Nuts & Seeds", icon: "⚪", name: "Flaxseeds (1 tbsp)", cal: 55, note: "Excellent fiber, add to oats", traffic: "green" },
  { cat: "🥜 Nuts & Seeds", icon: "⚫", name: "Sesame Seeds (1 tbsp)", cal: 52, note: "Calcium rich", traffic: "green" },

  // ─── DIM SUM & CHINESE ───
  { cat: "🥟 Dim Sum & Chinese", icon: "🥟", name: "Char Siew Bao (1 bun)", cal: 200, note: "Steamed better than baked", traffic: "yellow" },
  { cat: "🥟 Dim Sum & Chinese", icon: "🥟", name: "Siew Mai (1 piece)", cal: 45, note: "Good protein", traffic: "green" },
  { cat: "🥟 Dim Sum & Chinese", icon: "🥟", name: "Har Gow (1 piece)", cal: 40, note: "Shrimp dumpling — good", traffic: "green" },
  { cat: "🥟 Dim Sum & Chinese", icon: "🥟", name: "Cheung Fun (1 roll)", cal: 100, note: "Rice starch roll", traffic: "yellow" },
  { cat: "🥟 Dim Sum & Chinese", icon: "🥟", name: "Lo Mai Gai (1 parcel)", cal: 350, note: "Glutinous rice — high carb", traffic: "red" },
  { cat: "🥟 Dim Sum & Chinese", icon: "🥓", name: "Char Siew (100g)", cal: 220, note: "Sweet BBQ pork — moderate", traffic: "yellow" },
  { cat: "🥟 Dim Sum & Chinese", icon: "🦆", name: "Roast Duck (100g)", cal: 337, note: "High fat — remove skin", traffic: "yellow" },
  { cat: "🥟 Dim Sum & Chinese", icon: "🐔", name: "Roast Chicken (100g)", cal: 215, note: "Remove skin", traffic: "yellow" },
  { cat: "🥟 Dim Sum & Chinese", icon: "🍲", name: "Claypot Tofu (1 serving)", cal: 200, note: "Good protein dish", traffic: "green" },
  { cat: "🥟 Dim Sum & Chinese", icon: "🐟", name: "Steamed Fish with ginger", cal: 150, note: "Excellent lean choice", traffic: "green" },
  { cat: "🥟 Dim Sum & Chinese", icon: "🥬", name: "Stir Fry Veg (1 serving)", cal: 80, note: "Minimal oil version", traffic: "green" },

  // ─── INTERNATIONAL MAINS ───
  { cat: "🌍 International Mains", icon: "🍣", name: "Sushi Nigiri (8 pcs)", cal: 350, note: "Clean protein — good", traffic: "yellow" },
  { cat: "🌍 International Mains", icon: "🍣", name: "Salmon Sashimi (6 pcs)", cal: 200, note: "Excellent lean protein", traffic: "green" },
  { cat: "🌍 International Mains", icon: "🍣", name: "Sushi Roll (1 roll 8 pcs)", cal: 300, note: "Watch fillings", traffic: "yellow" },
  { cat: "🌍 International Mains", icon: "🥗", name: "Caesar Salad no dressing", cal: 150, note: "Good base", traffic: "green" },
  { cat: "🌍 International Mains", icon: "🥗", name: "Caesar Salad with dressing", cal: 350, note: "Dressing adds 200 cal", traffic: "yellow" },
  { cat: "🌍 International Mains", icon: "🥗", name: "Greek Salad", cal: 200, note: "Olive oil + feta — healthy fats", traffic: "green" },
  { cat: "🌍 International Mains", icon: "🥩", name: "Grilled Sirloin Steak (200g)", cal: 400, note: "Great protein meal", traffic: "green" },
  { cat: "🌍 International Mains", icon: "🐟", name: "Grilled Salmon (200g)", cal: 360, note: "Best dinner choice", traffic: "green" },
  { cat: "🌍 International Mains", icon: "🍟", name: "Fish & Chips", cal: 800, note: "Fried batter + fries — avoid", traffic: "red" },
  { cat: "🌍 International Mains", icon: "🍗", name: "Chicken Chop grilled", cal: 420, note: "Good if grilled not fried", traffic: "green" },
  { cat: "🌍 International Mains", icon: "🥩", name: "Lamb Chop", cal: 600, note: "High fat cut — limit", traffic: "yellow" },
  { cat: "🌍 International Mains", icon: "🌮", name: "Chicken Burrito (1)", cal: 550, note: "Wrap = hidden calories", traffic: "yellow" },
  { cat: "🌍 International Mains", icon: "🥙", name: "Chicken Shawarma wrap", cal: 500, note: "Good protein, high wrap cal", traffic: "yellow" },
  { cat: "🌍 International Mains", icon: "🍛", name: "Butter Chicken (200g no rice)", cal: 320, note: "Skip the rice", traffic: "yellow" },
  { cat: "🌍 International Mains", icon: "🥘", name: "Tom Kha Gai (1 bowl)", cal: 350, note: "Coconut milk soup", traffic: "yellow" },
  { cat: "🌍 International Mains", icon: "🥘", name: "Mushroom Cream Soup (1 bowl)", cal: 220, note: "Cream adds calories", traffic: "yellow" },
  { cat: "🌍 International Mains", icon: "🥘", name: "Minestrone Soup (1 bowl)", cal: 130, note: "Low cal filling soup", traffic: "green" },
  { cat: "🌍 International Mains", icon: "🫔", name: "Kebab wrap", cal: 500, note: "Good protein, watch bread", traffic: "yellow" },
  { cat: "🌍 International Mains", icon: "🍱", name: "Korean BBQ (200g meat only)", cal: 350, note: "No rice = great", traffic: "green" },
  { cat: "🌍 International Mains", icon: "🍜", name: "Korean Ramyeon (1 pack)", cal: 500, note: "High sodium + carb", traffic: "red" },

  // ─── DAIRY & CONDIMENTS ───
  { cat: "🧀 Dairy & Condiments", icon: "🧀", name: "Cheddar Cheese (30g)", cal: 120, note: "Protein + fat — moderate", traffic: "yellow" },
  { cat: "🧀 Dairy & Condiments", icon: "🧀", name: "Mozzarella (30g)", cal: 90, note: "Lower fat cheese", traffic: "yellow" },
  { cat: "🧀 Dairy & Condiments", icon: "🧀", name: "Cottage Cheese (100g)", cal: 98, note: "High protein, low fat", traffic: "green" },
  { cat: "🧀 Dairy & Condiments", icon: "🧈", name: "Butter (1 tbsp)", cal: 100, note: "Limit — saturated fat", traffic: "yellow" },
  { cat: "🧀 Dairy & Condiments", icon: "🫒", name: "Olive Oil (1 tbsp)", cal: 120, note: "Healthy fat — always measure", traffic: "yellow" },
  { cat: "🧀 Dairy & Condiments", icon: "🌿", name: "Coconut Oil (1 tbsp)", cal: 120, note: "High saturated fat", traffic: "yellow" },
  { cat: "🧀 Dairy & Condiments", icon: "🔴", name: "Tomato Ketchup (1 tbsp)", cal: 19, note: "Hidden sugar — limit", traffic: "yellow" },
  { cat: "🧀 Dairy & Condiments", icon: "🟡", name: "Mayonnaise (1 tbsp)", cal: 90, note: "High calorie condiment", traffic: "red" },
  { cat: "🧀 Dairy & Condiments", icon: "🟠", name: "Chilli Sauce (1 tbsp)", cal: 20, note: "OK in moderation", traffic: "green" },
  { cat: "🧀 Dairy & Condiments", icon: "🟫", name: "Soy Sauce (1 tbsp)", cal: 10, note: "High sodium — watch intake", traffic: "green" },
  { cat: "🧀 Dairy & Condiments", icon: "🟤", name: "Oyster Sauce (1 tbsp)", cal: 25, note: "Some sugar — use sparingly", traffic: "yellow" },
  { cat: "🧀 Dairy & Condiments", icon: "🟡", name: "Kaya Jam (1 tbsp)", cal: 50, note: "High sugar jam — avoid", traffic: "red" },
  { cat: "🧀 Dairy & Condiments", icon: "🍯", name: "Honey (1 tbsp)", cal: 64, note: "Still sugar — limit", traffic: "yellow" },
  { cat: "🧀 Dairy & Condiments", icon: "🌶️", name: "Sambal (1 tbsp)", cal: 25, note: "Chilli paste — watch sugar", traffic: "yellow" },
  { cat: "🧀 Dairy & Condiments", icon: "🟡", name: "Belacan / Shrimp Paste (1 tsp)", cal: 10, note: "High sodium, very small amount", traffic: "green" },

  // ─── WESTERN MAINS ───
  // Proteins: USDA FoodData Central verified. Composite dishes: estimated from standard recipes.
  { cat: "🍽 Western Mains", icon: "🥩", name: "Sirloin Steak grilled (200g)", cal: 368, note: "USDA: 184 cal/100g trimmed · great protein", traffic: "green" },
  { cat: "🍽 Western Mains", icon: "🥩", name: "Ribeye Steak (200g)", cal: 540, note: "Higher fat cut · USDA: ~270/100g", traffic: "yellow" },
  { cat: "🍽 Western Mains", icon: "🥩", name: "T-Bone Steak (200g trimmed)", cal: 380, note: "USDA: ~190/100g trimmed", traffic: "green" },
  { cat: "🍽 Western Mains", icon: "🥩", name: "Lamb Rack (200g)", cal: 480, note: "Rich, higher fat · USDA: ~240/100g", traffic: "yellow" },
  { cat: "🍽 Western Mains", icon: "🥩", name: "Lamb Chop (150g)", cal: 375, note: "USDA: ~250/100g with fat", traffic: "yellow" },
  { cat: "🍽 Western Mains", icon: "🍗", name: "Roast Chicken breast (150g)", cal: 248, note: "USDA verified · best lean choice", traffic: "green" },
  { cat: "🍽 Western Mains", icon: "🍗", name: "Grilled Chicken Chop (200g)", cal: 330, note: "Skin-off, grilled · excellent", traffic: "green" },
  { cat: "🍽 Western Mains", icon: "🍗", name: "BBQ Chicken (200g with skin)", cal: 440, note: "Skin adds ~100 cal", traffic: "yellow" },
  { cat: "🍽 Western Mains", icon: "🐟", name: "Grilled Salmon fillet (200g)", cal: 416, note: "USDA: 208/100g · best dinner", traffic: "green" },
  { cat: "🍽 Western Mains", icon: "🐟", name: "Baked Cod fillet (200g)", cal: 186, note: "USDA: 93/100g · very lean", traffic: "green" },
  { cat: "🍽 Western Mains", icon: "🐟", name: "Grilled Mahi-Mahi (200g)", cal: 197, note: "USDA: ~99/100g · lean white fish", traffic: "green" },
  { cat: "🍽 Western Mains", icon: "🐟", name: "Fish & Chips (full portion)", cal: 800, note: "Battered + fried + chips", traffic: "red" },
  { cat: "🍽 Western Mains", icon: "🥩", name: "Pork Tenderloin roasted (150g)", cal: 220, note: "USDA: 147/100g · lean pork", traffic: "green" },
  { cat: "🍽 Western Mains", icon: "🥩", name: "BBQ Pork Ribs (200g meat)", cal: 580, note: "High fat + BBQ sauce sugar", traffic: "red" },
  { cat: "🍽 Western Mains", icon: "🥩", name: "Roast Beef (150g)", cal: 276, note: "USDA: 184/100g sirloin", traffic: "green" },
  { cat: "🍽 Western Mains", icon: "🥩", name: "Beef Burger patty only (150g)", cal: 290, note: "USDA 90% lean: 194/100g", traffic: "yellow" },
  { cat: "🍽 Western Mains", icon: "🍔", name: "Beef Burger with bun + cheese", cal: 600, note: "Bun + patty + cheese + sauce", traffic: "red" },
  { cat: "🍽 Western Mains", icon: "🥚", name: "Omelette plain 2 eggs", cal: 190, note: "USDA: 78/egg + minimal oil", traffic: "green" },
  { cat: "🍽 Western Mains", icon: "🥚", name: "Omelette with cheese + veg", cal: 280, note: "Cheese adds ~90 cal", traffic: "green" },
  { cat: "🍽 Western Mains", icon: "🍳", name: "Eggs Benedict (2 eggs)", cal: 600, note: "Hollandaise sauce = 200+ cal alone", traffic: "red" },
  { cat: "🍽 Western Mains", icon: "🍳", name: "Fried Eggs 2 (minimal oil)", cal: 185, note: "USDA: ~78/egg + oil", traffic: "green" },
  { cat: "🍽 Western Mains", icon: "🥞", name: "French Toast (2 slices)", cal: 320, note: "Egg + bread + butter", traffic: "red" },
  { cat: "🍽 Western Mains", icon: "🥓", name: "Bacon 3 strips cooked (24g)", cal: 129, note: "USDA verified · high sodium", traffic: "yellow" },
  { cat: "🍽 Western Mains", icon: "🥓", name: "Full English Breakfast", cal: 800, note: "Eggs + bacon + sausage + beans + toast", traffic: "red" },
  { cat: "🍽 Western Mains", icon: "🥗", name: "Caesar Salad no dressing", cal: 80, note: "Romaine + croutons, no dressing", traffic: "green" },
  { cat: "🍽 Western Mains", icon: "🥗", name: "Caesar Salad with dressing", cal: 350, note: "Dressing adds ~270 cal", traffic: "yellow" },
  { cat: "🍽 Western Mains", icon: "🥗", name: "Cobb Salad (full)", cal: 520, note: "Egg + bacon + chicken + avocado", traffic: "yellow" },
  { cat: "🍽 Western Mains", icon: "🥗", name: "Greek Salad (full)", cal: 200, note: "Veg + feta + olive oil", traffic: "green" },
  { cat: "🍽 Western Mains", icon: "🥗", name: "Chicken Caesar Wrap", cal: 480, note: "Tortilla + chicken + dressing", traffic: "yellow" },
  { cat: "🍽 Western Mains", icon: "🥪", name: "Club Sandwich (3 layer)", cal: 560, note: "3 bread slices + mayo + meat", traffic: "red" },
  { cat: "🍽 Western Mains", icon: "🥪", name: "BLT Sandwich", cal: 400, note: "Bacon + lettuce + tomato + mayo", traffic: "yellow" },
  { cat: "🍽 Western Mains", icon: "🥪", name: "Grilled Cheese Sandwich", cal: 400, note: "2 slices bread + cheese + butter", traffic: "red" },
  { cat: "🍽 Western Mains", icon: "🥪", name: "Tuna Melt Sandwich", cal: 450, note: "Tuna + cheese + bread", traffic: "yellow" },
  { cat: "🍽 Western Mains", icon: "🥪", name: "Turkey Sandwich (no mayo)", cal: 300, note: "USDA deli turkey: 54 per 60g · good", traffic: "green" },
  { cat: "🍽 Western Mains", icon: "🥪", name: "Ham Sandwich (no mayo)", cal: 280, note: "USDA deli ham: 61 per 60g", traffic: "green" },
  { cat: "🍽 Western Mains", icon: "🍲", name: "Beef Stew (1 bowl 350g)", cal: 350, note: "Lean beef + veg · good choice", traffic: "green" },
  { cat: "🍽 Western Mains", icon: "🍲", name: "Chicken Soup homemade (1 bowl)", cal: 180, note: "Very low cal, high protein", traffic: "green" },
  { cat: "🍽 Western Mains", icon: "🍲", name: "Tomato Soup (1 bowl 250ml)", cal: 160, note: "Watch cream-added versions", traffic: "yellow" },
  { cat: "🍽 Western Mains", icon: "🥧", name: "Chicken Pot Pie (1 slice)", cal: 550, note: "Pastry crust = hidden calories", traffic: "red" },
  { cat: "🍽 Western Mains", icon: "🥧", name: "Shepherd's Pie (1 serving)", cal: 450, note: "Mashed potato top + meat filling", traffic: "yellow" },
  { cat: "🍽 Western Mains", icon: "🍕", name: "Pizza Margherita (2 slices)", cal: 500, note: "~250 per slice", traffic: "yellow" },
  { cat: "🍽 Western Mains", icon: "🌮", name: "Fish Tacos (2 tacos)", cal: 350, note: "Corn tortilla + fish + slaw", traffic: "yellow" },
  { cat: "🍽 Western Mains", icon: "🌮", name: "Chicken Tacos (2 tacos)", cal: 320, note: "Corn tortilla + grilled chicken", traffic: "yellow" },

  // ─── WESTERN SIDES ───
  { cat: "🍽 Western Mains", icon: "🥔", name: "Mashed Potato (1 cup 240g)", cal: 230, note: "Butter + milk adds cal", traffic: "yellow" },
  { cat: "🍽 Western Mains", icon: "🥔", name: "Baked Potato plain (medium)", cal: 161, note: "USDA: 161 for 173g · skip toppings", traffic: "yellow" },
  { cat: "🍽 Western Mains", icon: "🥔", name: "Baked Potato loaded (sour cream + cheese)", cal: 400, note: "Toppings double the calories", traffic: "red" },
  { cat: "🍽 Western Mains", icon: "🍟", name: "Restaurant Fries (100g)", cal: 312, note: "Deep fried · empty calories", traffic: "red" },
  { cat: "🍽 Western Mains", icon: "🍠", name: "Sweet Potato Fries (100g)", cal: 170, note: "Better than regular fries", traffic: "yellow" },
  { cat: "🍽 Western Mains", icon: "🧅", name: "Onion Rings (100g)", cal: 380, note: "Battered + fried", traffic: "red" },
  { cat: "🍽 Western Mains", icon: "🥗", name: "Coleslaw (100g)", cal: 150, note: "Mayo base — watch portion", traffic: "yellow" },
  { cat: "🍽 Western Mains", icon: "🌽", name: "Corn on the Cob (1 ear)", cal: 77, note: "USDA: 77 for 90g · good choice", traffic: "green" },
  { cat: "🍽 Western Mains", icon: "🥦", name: "Steamed Broccoli side (150g)", cal: 52, note: "Best side dish — eat freely", traffic: "green" },
  { cat: "🍽 Western Mains", icon: "🫘", name: "Baked Beans (100g)", cal: 94, note: "Good fiber + protein", traffic: "green" },
  { cat: "🍽 Western Mains", icon: "🥚", name: "Deviled Eggs (2 halves)", cal: 140, note: "Egg + mayo filling", traffic: "yellow" },
  { cat: "🍽 Western Mains", icon: "🧀", name: "Mac and Cheese homemade (1 cup)", cal: 490, note: "Pasta + cheese sauce", traffic: "red" },
  { cat: "🍽 Western Mains", icon: "🥩", name: "Beef Lasagne (1 serving 250g)", cal: 400, note: "Pasta + meat + cheese layers", traffic: "yellow" },
  { cat: "🍽 Western Mains", icon: "🍗", name: "Chicken Alfredo (1 plate)", cal: 720, note: "Cream sauce + pasta — heavy", traffic: "red" },

  // ─── WESTERN DELI & MEATS (USDA verified) ───
  { cat: "🍽 Western Mains", icon: "🥩", name: "Turkey Breast deli sliced (60g)", cal: 54, note: "USDA verified · best deli meat", traffic: "green" },
  { cat: "🍽 Western Mains", icon: "🥩", name: "Ham deli sliced (60g)", cal: 61, note: "USDA verified · moderate sodium", traffic: "green" },
  { cat: "🍽 Western Mains", icon: "🌭", name: "Hot Dog / Frankfurter (1)", cal: 180, note: "Processed meat — limit", traffic: "red" },
  { cat: "🍽 Western Mains", icon: "🌭", name: "Sausage pork link (1 cooked)", cal: 130, note: "High fat + sodium", traffic: "red" },
  { cat: "🍽 Western Mains", icon: "🥩", name: "Beef Meatballs (3 medium)", cal: 210, note: "Good protein, watch sauce", traffic: "yellow" },
];

const categories = ["All", ...Array.from(new Set(foods.map(f => f.cat)))];
const TC = { green: "#00c896", yellow: "#f5a623", red: "#ff5252" };
const TB = { green: "#00200f", yellow: "#1a1000", red: "#1f0000" };
const TL = { green: "✅ Safe", yellow: "⚠️ Moderate", red: "🚫 Avoid" };

export default function App() {
  const [cat, setCat] = useState("All");
  const [search, setSearch] = useState("");
  const [trafficFilter, setTrafficFilter] = useState("all");
  const [log, setLog] = useState([]);
  const [exercise, setExercise] = useState("none");
  const [view, setView] = useState("foods");

  const budget = TDEE_BASE + (exercise === "swim" ? SWIM_BONUS : exercise === "walk" ? WALK_BONUS : 0);
  const totalEaten = log.reduce((s, i) => s + i.cal, 0);
  const remaining = budget - totalEaten;
  const pct = Math.min((totalEaten / budget) * 100, 100);
  const barColor = totalEaten > budget ? "#ff5252" : totalEaten > budget * 0.85 ? "#f5a623" : "#00c896";

  const filtered = useMemo(() => foods.filter(f => {
    const matchCat = cat === "All" || f.cat === cat;
    const matchSearch = search.length < 2 || f.name.toLowerCase().includes(search.toLowerCase());
    const matchT = trafficFilter === "all" || f.traffic === trafficFilter;
    return matchCat && matchSearch && matchT;
  }), [cat, search, trafficFilter]);

  const addToLog = (food) => setLog(prev => [...prev, { ...food, id: Date.now() + Math.random() }]);
  const removeFromLog = (id) => setLog(prev => prev.filter(i => i.id !== id));

  return (
    <div style={{
      minHeight: "100vh", background: "#080808", color: "#e0e0e0",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      maxWidth: 500, margin: "0 auto", paddingBottom: 60,
    }}>

      {/* ── STICKY HEADER ── */}
      <div style={{
        background: "#0f0f0f", borderBottom: "1px solid #1e1e1e",
        padding: "14px 16px 12px", position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: -0.5 }}>🥗 CalTrack</div>
            <div style={{ fontSize: 10, color: "#444" }}>Mounjaro · 120kg · 174cm · 42y · {foods.length} foods · USDA verified</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { key: "none", icon: "💤" },
              { key: "swim", icon: "🏊" },
              { key: "walk", icon: "🚶" },
            ].map(e => (
              <button key={e.key} onClick={() => setExercise(e.key)} style={{
                background: exercise === e.key ? "#1a2a1a" : "#111",
                border: `1px solid ${exercise === e.key ? "#00c896" : "#222"}`,
                color: exercise === e.key ? "#00c896" : "#444",
                borderRadius: 20, padding: "6px 12px", fontSize: 14,
                cursor: "pointer", fontFamily: "inherit",
              }}>{e.icon}</button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          {[
            { label: "Budget", val: budget, color: "#666" },
            { label: "Eaten", val: totalEaten, color: barColor },
            { label: remaining >= 0 ? "Left" : "Over!", val: Math.abs(remaining), color: remaining < 0 ? "#ff5252" : "#00c896" },
          ].map(b => (
            <div key={b.label} style={{ flex: 1, background: "#111", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 9, color: "#555", letterSpacing: 1 }}>{b.label.toUpperCase()}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: b.color }}>{b.val}</div>
              <div style={{ fontSize: 9, color: "#333" }}>cal</div>
            </div>
          ))}
        </div>
        <div style={{ background: "#1a1a1a", borderRadius: 3, height: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 3, transition: "width 0.4s" }} />
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          {["foods", "log"].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              flex: 1, background: view === v ? "#1e1e1e" : "transparent",
              border: `1px solid ${view === v ? "#333" : "#1a1a1a"}`,
              color: view === v ? "#fff" : "#555",
              borderRadius: 8, padding: "8px", fontSize: 12,
              cursor: "pointer", fontFamily: "inherit",
            }}>
              {v === "foods" ? `🍽 Foods (${filtered.length})` : `📋 Log (${log.length}${log.length > 0 ? " · " + totalEaten + "cal" : ""})`}
            </button>
          ))}
        </div>
      </div>

      {/* ── FOODS VIEW ── */}
      {view === "foods" && (
        <div style={{ padding: "14px 16px" }}>
          <input
            placeholder="🔍  Search any food or dish..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", background: "#111", border: "1px solid #222",
              borderRadius: 10, padding: "12px 14px", color: "#eee",
              fontFamily: "inherit", fontSize: 16, marginBottom: 10,
              boxSizing: "border-box", outline: "none",
            }}
          />

          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {["all", "green", "yellow", "red"].map(t => (
              <button key={t} onClick={() => setTrafficFilter(t)} style={{
                flex: 1,
                background: trafficFilter === t ? (t === "all" ? "#1e1e1e" : TB[t]) : "#0f0f0f",
                border: `1px solid ${trafficFilter === t ? (t === "all" ? "#333" : TC[t]) : "#1e1e1e"}`,
                color: trafficFilter === t ? (t === "all" ? "#ccc" : TC[t]) : "#444",
                borderRadius: 8, padding: "7px 4px", fontSize: 11,
                cursor: "pointer", fontFamily: "inherit",
              }}>
                {t === "all" ? "All" : TL[t].split(" ")[0]}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 10 }}>
            {categories.map(c => (
              <button key={c} onClick={() => setCat(c)} style={{
                background: cat === c ? "#1a2a1a" : "#0f0f0f",
                border: `1px solid ${cat === c ? "#00c896" : "#1e1e1e"}`,
                color: cat === c ? "#00c896" : "#555",
                borderRadius: 20, padding: "6px 12px", fontSize: 11,
                cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit", flexShrink: 0,
              }}>
                {c === "All" ? "🌐 All" : c.split(" ").slice(0, 2).join(" ")}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filtered.map((food, i) => (
              <div key={i} onClick={() => addToLog(food)} style={{
                background: "#0f0f0f", border: "1px solid #1a1a1a",
                borderLeft: `3px solid ${TC[food.traffic]}`,
                borderRadius: 10, padding: "11px 14px",
                display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
              }}
                onMouseEnter={e => e.currentTarget.style.background = "#161616"}
                onMouseLeave={e => e.currentTarget.style.background = "#0f0f0f"}
              >
                <div style={{ fontSize: 28, width: 36, textAlign: "center", flexShrink: 0 }}>{food.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "#ddd", fontWeight: 600, marginBottom: 2 }}>{food.name}</div>
                  <div style={{ fontSize: 11, color: "#444", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{food.note}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: TC[food.traffic] }}>{food.cal}</div>
                  <div style={{ fontSize: 9, color: "#333" }}>cal</div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ textAlign: "center", color: "#333", padding: 50, fontSize: 14 }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
                Nothing found. Try a different word.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── LOG VIEW ── */}
      {view === "log" && (
        <div style={{ padding: "14px 16px" }}>
          {log.length === 0 ? (
            <div style={{ textAlign: "center", color: "#333", padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🍽</div>
              <div style={{ fontSize: 14 }}>Tap any food to log it here</div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                {log.map(item => (
                  <div key={item.id} style={{
                    background: "#0f0f0f", border: "1px solid #1a1a1a",
                    borderRadius: 10, padding: "11px 14px",
                    display: "flex", alignItems: "center", gap: 12,
                  }}>
                    <div style={{ fontSize: 24, width: 32, textAlign: "center" }}>{item.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: "#ddd", fontWeight: 600 }}>{item.name}</div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: TC[item.traffic], marginRight: 8 }}>{item.cal}</div>
                    <div onClick={() => removeFromLog(item.id)} style={{ color: "#ff5252", cursor: "pointer", fontSize: 20, padding: "4px 8px" }}>✕</div>
                  </div>
                ))}
              </div>
              <div style={{
                background: "#111", border: "1px solid #222", borderRadius: 10,
                padding: 16, textAlign: "center",
              }}>
                <div style={{ fontSize: 11, color: "#555", marginBottom: 4 }}>TOTAL EATEN TODAY</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: barColor, marginBottom: 4 }}>{totalEaten}</div>
                <div style={{ fontSize: 12, color: "#555" }}>
                  of {budget} cal · {Math.abs(remaining)} cal {remaining >= 0 ? "remaining" : "over budget ⚠️"}
                </div>
                <button onClick={() => setLog([])} style={{
                  marginTop: 12, background: "#1a0000", border: "1px solid #ff5252",
                  color: "#ff5252", borderRadius: 8, padding: "8px 20px",
                  fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                }}>Clear Today's Log</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
