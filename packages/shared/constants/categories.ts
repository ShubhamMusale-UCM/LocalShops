export const CATEGORIES = [
  {
    id: 'grocery',
    name: 'Grocery & Daily Needs',
    icon: '🛒',
    subCategories: ['Fruits & Vegetables', 'Dairy', 'Spices', 'Staples', 'Snacks', 'Beverages', 'Personal Care', 'Household'],
  },
  {
    id: 'electronics',
    name: 'Electronics',
    icon: '📱',
    subCategories: ['Mobile Phones', 'Laptops', 'TVs', 'Audio', 'Accessories', 'Computer Parts', 'Cameras', 'Gaming'],
  },
  {
    id: 'clothing',
    name: 'Clothing & Fashion',
    icon: '👕',
    subCategories: ['Men', 'Women', 'Kids', 'Ethnic Wear', 'Western Wear', 'Footwear', 'Accessories', 'Bags'],
  },
  {
    id: 'furniture',
    name: 'Furniture & Home Decor',
    icon: '🛋️',
    subCategories: ['Living Room', 'Bedroom', 'Kitchen', 'Office', 'Outdoor', 'Decoratives', 'Lighting', 'Storage'],
  },
  {
    id: 'food',
    name: 'Food & Restaurants',
    icon: '🍕',
    subCategories: [
      'Bakery', 
      'Sweets', 
      'Street Food', 
      'Restaurant', 
      'Cafe', 
      'Juice & Smoothies', 
      'Tiffin Service',
      'Fast Food',
      'Fine Dining',
      'Desserts & Pastries',
      'Ethnic Cuisine',
      'Cloud Kitchen',
      'Menu & Catering'
    ],
    showcaseFields: ['menu', 'cuisine', 'delivery_time', 'rating', 'special_offers'],
  },
  {
    id: 'hotels',
    name: 'Hotels & Lodging',
    icon: '🏨',
    subCategories: [
      'Budget Hotels',
      'Luxury Hotels',
      'Guest Houses',
      'Heritage Hotels',
      'Resort',
      'Boutique Hotels',
      'Service Apartments',
      'Hostels'
    ],
    showcaseFields: ['rooms', 'amenities', 'price_range', 'rating', 'images', 'contact_info'],
  },
  {
    id: 'property',
    name: 'Real Estate & Properties',
    icon: '🏢',
    subCategories: ['Flats & Apartments', 'Villas', 'Commercial Space', 'Plots & Land', 'PG/Co-living', 'Builder Floors'],
  },
  {
    id: 'tours',
    name: 'Tour Packages',
    icon: '✈️',
    subCategories: ['Domestic Tours', 'International Tours', 'Weekend Getaways', 'Adventure Trips', 'Honeymoon Packages', 'Pilgrimage'],
  },
  {
    id: 'places',
    name: 'Places to Visit',
    icon: '🗺️',
    subCategories: ['Historical Sites', 'Parks & Nature', 'Museums', 'Amusement Parks', 'Religious Places', 'Monuments'],
  },
  {
    id: 'secondhand',
    name: 'Second Hand Market',
    icon: '♻️',
    subCategories: ['Used Cars & Bikes', 'Refurbished Electronics', 'Used Furniture', 'Pre-owned Books', 'Used Appliances'],
  },
  {
    id: 'health',
    name: 'Health & Wellness',
    icon: '💊',
    subCategories: ['Pharmacy', 'Ayurvedic', 'Gym & Fitness', 'Optical', 'Medical Equipment', 'Supplements'],
  },
  {
    id: 'beauty',
    name: 'Beauty & Salon',
    icon: '💄',
    subCategories: ['Salon', 'Spa', 'Cosmetics', 'Skincare', 'Hair Care', 'Bridal', 'Men Grooming'],
  },
  {
    id: 'jewellery',
    name: 'Jewellery & Watches',
    icon: '💎',
    subCategories: ['Gold', 'Silver', 'Diamond', 'Artificial', 'Watches', 'Traditional', 'Bridal Collection'],
  },
  {
    id: 'books',
    name: 'Books & Stationery',
    icon: '📚',
    subCategories: ['Academic', 'Fiction', 'Non-Fiction', 'Stationery', 'Art Supplies', 'Magazines', 'Children Books'],
  },
  {
    id: 'sports',
    name: 'Sports & Fitness',
    icon: '⚽',
    subCategories: ['Cricket', 'Football', 'Badminton', 'Gym Equipment', 'Sportswear', 'Cycling', 'Swimming'],
  },
  {
    id: 'automotive',
    name: 'Automotive',
    icon: '🚗',
    subCategories: ['Car Accessories', 'Bike Accessories', 'Service Center', 'Spare Parts', 'Tyres', 'Car Care'],
  },
  {
    id: 'hardware',
    name: 'Hardware & Tools',
    icon: '🔧',
    subCategories: ['Power Tools', 'Hand Tools', 'Plumbing', 'Electrical', 'Paint', 'Building Materials'],
  },
  {
    id: 'pets',
    name: 'Pets & Animals',
    icon: '🐾',
    subCategories: ['Pet Food', 'Accessories', 'Grooming', 'Veterinary', 'Fish & Aquarium', 'Dog', 'Cat'],
  },
  {
    id: 'services',
    name: 'Local Services',
    icon: '🔨',
    subCategories: ['Electrician', 'Plumber', 'Carpenter', 'AC Repair', 'Pest Control', 'Cleaning', 'Movers & Packers'],
  },
  {
    id: 'toys',
    name: 'Toys & Games',
    icon: '🧸',
    subCategories: ['Action Figures', 'Board Games', 'Educational Toys', 'Dolls', 'Outdoor Play'],
  },
  {
    id: 'garden',
    name: 'Home & Garden',
    icon: '🪴',
    subCategories: ['Plants', 'Seeds', 'Garden Tools', 'Pots & Planters', 'Fertilizers'],
  },
  {
    id: 'education',
    name: 'Education',
    icon: '🎓',
    subCategories: ['Courses', 'Tutors', 'School Supplies', 'Uniforms', 'Test Prep'],
  },
  {
    id: 'art',
    name: 'Art & Collectibles',
    icon: '🎨',
    subCategories: ['Paintings', 'Sculptures', 'Handicrafts', 'Antiques', 'Art Supplies'],
  },
  {
    id: 'secondhand',
    name: 'Second Hand Market',
    icon: '♻️',
    subCategories: ['Used Cars & Bikes', 'Refurbished Electronics', 'Used Furniture', 'Pre-owned Books'],
  },
] as const;

export type CategoryId = typeof CATEGORIES[number]['id'];

export const getCategoryById = (id: string) => CATEGORIES.find(c => c.id === id);

export const getAllSubCategories = (categoryId: string): string[] => {
  const category = getCategoryById(categoryId);
  return category ? [...category.subCategories] : [];
};
