export interface CountryStateData {
  code: string;
  name: string;
  flag: string;
  phoneCode: string;
  states: string[];
}

const RAW_COUNTRIES_DATA: CountryStateData[] = [
  {
    "code": "PK",
    "name": "Pakistan",
    "flag": "🇵🇰",
    "phoneCode": "+92",
    "states": [
      "Punjab",
      "Sindh",
      "Khyber Pakhtunkhwa",
      "Balochistan",
      "Islamabad Capital Territory",
      "Azad Jammu & Kashmir",
      "Gilgit-Baltistan"
    ]
  },
  {
    "code": "AE",
    "name": "United Arab Emirates",
    "flag": "🇦🇪",
    "phoneCode": "+971",
    "states": [
      "Dubai",
      "Abu Dhabi",
      "Sharjah",
      "Ajman",
      "Ras Al Khaimah",
      "Fujairah",
      "Umm Al Quwain"
    ]
  },
  {
    "code": "SA",
    "name": "Saudi Arabia",
    "flag": "🇸🇦",
    "phoneCode": "+966",
    "states": [
      "Riyadh",
      "Makkah (Mecca)",
      "Madinah (Medina)",
      "Eastern Province (Ash Sharqiyah)",
      "Asir",
      "Tabuk",
      "Al-Qassim",
      "Hail",
      "Jazan",
      "Najran",
      "Al-Bahah",
      "Northern Borders",
      "Al-Jowf"
    ]
  },
  {
    "code": "US",
    "name": "United States",
    "flag": "🇺🇸",
    "phoneCode": "+1",
    "states": [
      "California",
      "Texas",
      "Florida",
      "New York",
      "Pennsylvania",
      "Illinois",
      "Ohio",
      "Georgia",
      "North Carolina",
      "Michigan",
      "New Jersey",
      "Virginia",
      "Washington",
      "Arizona",
      "Massachusetts",
      "Tennessee",
      "Indiana",
      "Missouri",
      "Maryland",
      "Wisconsin",
      "Colorado",
      "Minnesota",
      "South Carolina",
      "Alabama",
      "Louisiana",
      "Kentucky",
      "Oregon",
      "Oklahoma",
      "Connecticut",
      "Utah",
      "Iowa",
      "Nevada",
      "Arkansas",
      "Mississippi",
      "Kansas",
      "New Mexico",
      "Nebraska",
      "Idaho",
      "West Virginia",
      "Hawaii",
      "New Hampshire",
      "Maine",
      "Rhode Island",
      "Montana",
      "Delaware",
      "South Dakota",
      "North Dakota",
      "Alaska",
      "Vermont",
      "Wyoming",
      "District of Columbia"
    ]
  },
  {
    "code": "GB",
    "name": "United Kingdom",
    "flag": "🇬🇧",
    "phoneCode": "+44",
    "states": [
      "England",
      "Scotland",
      "Wales",
      "Northern Ireland",
      "Greater London",
      "West Midlands",
      "Greater Manchester",
      "West Yorkshire"
    ]
  },
  {
    "code": "CA",
    "name": "Canada",
    "flag": "🇨🇦",
    "phoneCode": "+1",
    "states": [
      "Ontario",
      "Quebec",
      "British Columbia",
      "Alberta",
      "Manitoba",
      "Saskatchewan",
      "Nova Scotia",
      "New Brunswick",
      "Newfoundland and Labrador",
      "Prince Edward Island",
      "Northwest Territories",
      "Yukon",
      "Nunavut"
    ]
  },
  {
    "code": "AU",
    "name": "Australia",
    "flag": "🇦🇺",
    "phoneCode": "+61",
    "states": [
      "New South Wales",
      "Victoria",
      "Queensland",
      "Western Australia",
      "South Australia",
      "Tasmania",
      "Australian Capital Territory",
      "Northern Territory"
    ]
  },
  {
    "code": "QA",
    "name": "Qatar",
    "flag": "🇶🇦",
    "phoneCode": "+974",
    "states": [
      "Doha",
      "Al Rayyan",
      "Al Wakrah",
      "Al Daayen",
      "Umm Salal",
      "Al Khor",
      "Al Shamal",
      "Al Shahaniya"
    ]
  },
  {
    "code": "KW",
    "name": "Kuwait",
    "flag": "🇰🇼",
    "phoneCode": "+965",
    "states": [
      "Al Asimah (Capital)",
      "Hawalli",
      "Farwaniya",
      "Ahmadi",
      "Jahra",
      "Mubarak Al-Kabeer"
    ]
  },
  {
    "code": "OM",
    "name": "Oman",
    "flag": "🇴🇲",
    "phoneCode": "+968",
    "states": [
      "Muscat",
      "Dhofar",
      "Musandam",
      "Al Buraimi",
      "Ad Dakhiliyah",
      "Al Batinah North",
      "Al Batinah South",
      "Ash Sharqiyah North",
      "Ash Sharqiyah South",
      "Ad Dhahirah",
      "Al Wusta"
    ]
  },
  {
    "code": "BH",
    "name": "Bahrain",
    "flag": "🇧🇭",
    "phoneCode": "+973",
    "states": [
      "Capital Governorate (Manama)",
      "Muharraq Governorate",
      "Northern Governorate",
      "Southern Governorate"
    ]
  },
  {
    "code": "TR",
    "name": "Turkey",
    "flag": "🇹🇷",
    "phoneCode": "+90",
    "states": [
      "Istanbul",
      "Ankara",
      "Izmir",
      "Bursa",
      "Antalya",
      "Adana",
      "Konya",
      "Gaziantep",
      "Sanliurfa",
      "Mersin"
    ]
  },
  {
    "code": "DE",
    "name": "Germany",
    "flag": "🇩🇪",
    "phoneCode": "+49",
    "states": [
      "Bavaria",
      "Berlin",
      "Baden-Württemberg",
      "North Rhine-Westphalia",
      "Hesse",
      "Hamburg",
      "Saxony",
      "Lower Saxony",
      "Rhineland-Palatinate"
    ]
  },
  {
    "code": "MY",
    "name": "Malaysia",
    "flag": "🇲🇾",
    "phoneCode": "+60",
    "states": [
      "Selangor",
      "Kuala Lumpur",
      "Penang",
      "Johor",
      "Perak",
      "Sabah",
      "Sarawak",
      "Kedah",
      "Pahang",
      "Negeri Sembilan"
    ]
  },
  {
    "code": "SG",
    "name": "Singapore",
    "flag": "🇸🇬",
    "phoneCode": "+65",
    "states": [
      "Central Region",
      "East Region",
      "North Region",
      "North-East Region",
      "West Region"
    ]
  },
  {
    "code": "IN",
    "name": "India",
    "flag": "🇮🇳",
    "phoneCode": "+91",
    "states": [
      "Maharashtra",
      "Delhi",
      "Karnataka",
      "Tamil Nadu",
      "Uttar Pradesh",
      "Gujarat",
      "Punjab",
      "West Bengal",
      "Rajasthan",
      "Kerala",
      "Telangana",
      "Haryana"
    ]
  },
  {
    "code": "CN",
    "name": "China",
    "flag": "🇨🇳",
    "phoneCode": "+86",
    "states": [
      "Guangdong",
      "Shandong",
      "Henan",
      "Sichuan",
      "Jiangsu",
      "Hebei",
      "Hunan",
      "Anhui",
      "Hubei",
      "Zhejiang",
      "Beijing",
      "Shanghai"
    ]
  },
  {
    "code": "AF",
    "name": "Afghanistan",
    "flag": "🇦🇫",
    "phoneCode": "+93",
    "states": [
      "Kabul",
      "Herat",
      "Kandahar",
      "Balkh",
      "Nangarhar"
    ]
  },
  {
    "code": "AL",
    "name": "Albania",
    "flag": "🇦🇱",
    "phoneCode": "+355",
    "states": [
      "Tirana",
      "Durres",
      "Vlore",
      "Shkoder",
      "Fier"
    ]
  },
  {
    "code": "DZ",
    "name": "Algeria",
    "flag": "🇩🇿",
    "phoneCode": "+213",
    "states": [
      "Algiers",
      "Oran",
      "Constantine",
      "Annaba",
      "Blida"
    ]
  },
  {
    "code": "AD",
    "name": "Andorra",
    "flag": "🇦🇩",
    "phoneCode": "+376",
    "states": [
      "Andorra la Vella",
      "Escaldes-Engordany",
      "Encamp"
    ]
  },
  {
    "code": "AO",
    "name": "Angola",
    "flag": "🇦🇴",
    "phoneCode": "+244",
    "states": [
      "Luanda",
      "Huambo",
      "Benguela",
      "Cabinda",
      "Lubango"
    ]
  },
  {
    "code": "AG",
    "name": "Antigua and Barbuda",
    "flag": "🇦🇬",
    "phoneCode": "+1-268",
    "states": [
      "Saint John",
      "Saint George",
      "Saint Peter"
    ]
  },
  {
    "code": "AR",
    "name": "Argentina",
    "flag": "🇦🇷",
    "phoneCode": "+54",
    "states": [
      "Buenos Aires",
      "Cordoba",
      "Santa Fe",
      "Mendoza",
      "Tucuman"
    ]
  },
  {
    "code": "AM",
    "name": "Armenia",
    "flag": "🇦🇲",
    "phoneCode": "+374",
    "states": [
      "Yerevan",
      "Shirak",
      "Lori",
      "Kotayk",
      "Ararat"
    ]
  },
  {
    "code": "AT",
    "name": "Austria",
    "flag": "🇦🇹",
    "phoneCode": "+43",
    "states": [
      "Vienna",
      "Lower Austria",
      "Upper Austria",
      "Styria",
      "Tyrol",
      "Salzburg"
    ]
  },
  {
    "code": "AZ",
    "name": "Azerbaijan",
    "flag": "🇦🇿",
    "phoneCode": "+994",
    "states": [
      "Baku",
      "Ganja",
      "Sumqayit",
      "Mingachevir",
      "Lankaran"
    ]
  },
  {
    "code": "BS",
    "name": "Bahamas",
    "flag": "🇧🇸",
    "phoneCode": "+1-242",
    "states": [
      "New Providence",
      "Grand Bahama",
      "Abaco",
      "Eleuthera"
    ]
  },
  {
    "code": "BD",
    "name": "Bangladesh",
    "flag": "🇧🇩",
    "phoneCode": "+880",
    "states": [
      "Dhaka",
      "Chittagong",
      "Rajshahi",
      "Khulna",
      "Sylhet",
      "Barisal",
      "Rangpur",
      "Mymensingh"
    ]
  },
  {
    "code": "BB",
    "name": "Barbados",
    "flag": "🇧🇧",
    "phoneCode": "+1-246",
    "states": [
      "Saint Michael (Bridgetown)",
      "Christ Church",
      "Saint James"
    ]
  },
  {
    "code": "BY",
    "name": "Belarus",
    "flag": "🇧🇾",
    "phoneCode": "+375",
    "states": [
      "Minsk",
      "Gomel",
      "Brest",
      "Vitebsk",
      "Grodno",
      "Mogilev"
    ]
  },
  {
    "code": "BE",
    "name": "Belgium",
    "flag": "🇧🇪",
    "phoneCode": "+32",
    "states": [
      "Brussels",
      "Antwerp",
      "East Flanders",
      "Flemish Brabant",
      "Walloon Brabant",
      "Liege"
    ]
  },
  {
    "code": "BZ",
    "name": "Belize",
    "flag": "🇧🇿",
    "phoneCode": "+501",
    "states": [
      "Belize District",
      "Cayo",
      "Orange Walk",
      "Corozal",
      "Stann Creek"
    ]
  },
  {
    "code": "BJ",
    "name": "Benin",
    "flag": "🇧🇯",
    "phoneCode": "+229",
    "states": [
      "Littoral (Cotonou)",
      "Atlantique",
      "Oueme (Porto-Novo)",
      "Borgou"
    ]
  },
  {
    "code": "BT",
    "name": "Bhutan",
    "flag": "🇧🇹",
    "phoneCode": "+975",
    "states": [
      "Thimphu",
      "Chhukha",
      "Paro",
      "Punakha",
      "Samtse"
    ]
  },
  {
    "code": "BO",
    "name": "Bolivia",
    "flag": "🇧🇴",
    "phoneCode": "+591",
    "states": [
      "La Paz",
      "Santa Cruz",
      "Cochabamba",
      "Oruro",
      "Potosi"
    ]
  },
  {
    "code": "BA",
    "name": "Bosnia and Herzegovina",
    "flag": "🇧🇦",
    "phoneCode": "+387",
    "states": [
      "Sarajevo",
      "Banja Luka",
      "Tuzla",
      "Zenica",
      "Mostar"
    ]
  },
  {
    "code": "BW",
    "name": "Botswana",
    "flag": "🇧🇼",
    "phoneCode": "+267",
    "states": [
      "Gaborone",
      "Francistown",
      "Kweneng",
      "Central District"
    ]
  },
  {
    "code": "BR",
    "name": "Brazil",
    "flag": "🇧🇷",
    "phoneCode": "+55",
    "states": [
      "Sao Paulo",
      "Rio de Janeiro",
      "Minas Gerais",
      "Bahia",
      "Parana",
      "Rio Grande do Sul",
      "Ceara",
      "Distrito Federal"
    ]
  },
  {
    "code": "BN",
    "name": "Brunei",
    "flag": "🇧🇳",
    "phoneCode": "+673",
    "states": [
      "Brunei-Muara (Bandar Seri Begawan)",
      "Belait",
      "Tutong",
      "Temburong"
    ]
  },
  {
    "code": "BG",
    "name": "Bulgaria",
    "flag": "🇧🇬",
    "phoneCode": "+359",
    "states": [
      "Sofia",
      "Plovdiv",
      "Varna",
      "Burgas",
      "Ruse"
    ]
  },
  {
    "code": "BF",
    "name": "Burkina Faso",
    "flag": "🇧🇫",
    "phoneCode": "+226",
    "states": [
      "Centre (Ouagadougou)",
      "Hauts-Bassins",
      "Boucle du Mouhoun"
    ]
  },
  {
    "code": "BI",
    "name": "Burundi",
    "flag": "🇧🇮",
    "phoneCode": "+257",
    "states": [
      "Bujumbura Mairie",
      "Gitega",
      "Ngozi",
      "Kayanza"
    ]
  },
  {
    "code": "KH",
    "name": "Cambodia",
    "flag": "🇰🇭",
    "phoneCode": "+855",
    "states": [
      "Phnom Penh",
      "Siem Reap",
      "Battambang",
      "Kandal",
      "Sihanoukville"
    ]
  },
  {
    "code": "CM",
    "name": "Cameroon",
    "flag": "🇨🇲",
    "phoneCode": "+237",
    "states": [
      "Centre (Yaounde)",
      "Littoral (Douala)",
      "Far North",
      "West"
    ]
  },
  {
    "code": "CV",
    "name": "Cape Verde",
    "flag": "🇨🇻",
    "phoneCode": "+238",
    "states": [
      "Praia (Santiago)",
      "Mindelo (Sao Vicente)",
      "Sal",
      "Boa Vista"
    ]
  },
  {
    "code": "CF",
    "name": "Central African Republic",
    "flag": "🇨🇫",
    "phoneCode": "+236",
    "states": [
      "Bangui",
      "Ombella-M'Poko",
      "Ouham",
      "Lobaye"
    ]
  },
  {
    "code": "TD",
    "name": "Chad",
    "flag": "🇹🇩",
    "phoneCode": "+235",
    "states": [
      "N'Djamena",
      "Logone Occidental",
      "Mayo-Kebbi",
      "Waddi Fira"
    ]
  },
  {
    "code": "CL",
    "name": "Chile",
    "flag": "🇨🇱",
    "phoneCode": "+56",
    "states": [
      "Santiago Metropolitan",
      "Valparaiso",
      "Biobio",
      "Antofagasta",
      "Coquimbo"
    ]
  },
  {
    "code": "CO",
    "name": "Colombia",
    "flag": "🇨🇴",
    "phoneCode": "+57",
    "states": [
      "Bogota D.C.",
      "Antioquia (Medellin)",
      "Valle del Cauca (Cali)",
      "Atlantico (Barranquilla)"
    ]
  },
  {
    "code": "KM",
    "name": "Comoros",
    "flag": "🇰🇲",
    "phoneCode": "+269",
    "states": [
      "Grande Comore (Moroni)",
      "Anjouan",
      "Moheli"
    ]
  },
  {
    "code": "CG",
    "name": "Congo (Republic)",
    "flag": "🇨🇬",
    "phoneCode": "+242",
    "states": [
      "Brazzaville",
      "Pointe-Noire",
      "Niari",
      "Bouenza"
    ]
  },
  {
    "code": "CD",
    "name": "Congo (DRC)",
    "flag": "🇨🇩",
    "phoneCode": "+243",
    "states": [
      "Kinshasa",
      "Haut-Katanga (Lubumbashi)",
      "North Kivu (Goma)",
      "South Kivu (Bukavu)"
    ]
  },
  {
    "code": "CR",
    "name": "Costa Rica",
    "flag": "🇨🇷",
    "phoneCode": "+506",
    "states": [
      "San Jose",
      "Alajuela",
      "Cartago",
      "Heredia",
      "Guanacaste"
    ]
  },
  {
    "code": "HR",
    "name": "Croatia",
    "flag": "🇭🇷",
    "phoneCode": "+385",
    "states": [
      "Zagreb",
      "Split-Dalmatia",
      "Primorje-Gorski Kotar",
      "Istria",
      "Osijek-Baranja"
    ]
  },
  {
    "code": "CU",
    "name": "Cuba",
    "flag": "🇨🇺",
    "phoneCode": "+53",
    "states": [
      "Havana",
      "Santiago de Cuba",
      "Holguin",
      "Camaguey",
      "Villa Clara"
    ]
  },
  {
    "code": "CY",
    "name": "Cyprus",
    "flag": "🇨🇾",
    "phoneCode": "+357",
    "states": [
      "Nicosia",
      "Limassol",
      "Larnaca",
      "Paphos",
      "Famagusta"
    ]
  },
  {
    "code": "CZ",
    "name": "Czech Republic",
    "flag": "🇨🇿",
    "phoneCode": "+420",
    "states": [
      "Prague",
      "Central Bohemia",
      "South Moravia (Brno)",
      "Moravia-Silesia (Ostrava)"
    ]
  },
  {
    "code": "DK",
    "name": "Denmark",
    "flag": "🇩🇰",
    "phoneCode": "+45",
    "states": [
      "Capital Region (Copenhagen)",
      "Central Denmark",
      "Southern Denmark",
      "North Denmark",
      "Zealand"
    ]
  },
  {
    "code": "DJ",
    "name": "Djibouti",
    "flag": "🇩🇯",
    "phoneCode": "+253",
    "states": [
      "Djibouti City",
      "Ali Sabieh",
      "Tadjourah",
      "Dikhil"
    ]
  },
  {
    "code": "DM",
    "name": "Dominica",
    "flag": "🇩🇲",
    "phoneCode": "+1-767",
    "states": [
      "Saint George (Roseau)",
      "Saint Paul",
      "Saint David"
    ]
  },
  {
    "code": "DO",
    "name": "Dominican Republic",
    "flag": "🇩🇴",
    "phoneCode": "+1-809",
    "states": [
      "Santo Domingo",
      "Distrito Nacional",
      "Santiago",
      "San Cristobal",
      "La Altagracia"
    ]
  },
  {
    "code": "EC",
    "name": "Ecuador",
    "flag": "🇪🇨",
    "phoneCode": "+593",
    "states": [
      "Pichincha (Quito)",
      "Guayas (Guayaquil)",
      "Azuay (Cuenca)",
      "Manabi"
    ]
  },
  {
    "code": "EG",
    "name": "Egypt",
    "flag": "🇪🇬",
    "phoneCode": "+20",
    "states": [
      "Cairo",
      "Giza",
      "Alexandria",
      "Dakahlia",
      "Sharqia",
      "Qalyubia",
      "Red Sea (Hurghada)",
      "South Sinai (Sharm)"
    ]
  },
  {
    "code": "SV",
    "name": "El Salvador",
    "flag": "🇸🇻",
    "phoneCode": "+503",
    "states": [
      "San Salvador",
      "La Libertad",
      "Santa Ana",
      "San Miguel"
    ]
  },
  {
    "code": "GQ",
    "name": "Equatorial Guinea",
    "flag": "🇬🇶",
    "phoneCode": "+240",
    "states": [
      "Bioko Norte (Malabo)",
      "Litoral (Bata)",
      "Kie-Ntem"
    ]
  },
  {
    "code": "ER",
    "name": "Eritrea",
    "flag": "🇪🇷",
    "phoneCode": "+291",
    "states": [
      "Maekel (Asmara)",
      "Debub",
      "Gash-Barka",
      "Anseba"
    ]
  },
  {
    "code": "EE",
    "name": "Estonia",
    "flag": "🇪🇪",
    "phoneCode": "+372",
    "states": [
      "Harju (Tallinn)",
      "Tartu",
      "Ida-Viru",
      "Parnu"
    ]
  },
  {
    "code": "SZ",
    "name": "Eswatini",
    "flag": "🇸🇿",
    "phoneCode": "+268",
    "states": [
      "Hhohho (Mbabane)",
      "Manzini",
      "Lubombo",
      "Shiselweni"
    ]
  },
  {
    "code": "ET",
    "name": "Ethiopia",
    "flag": "🇪🇹",
    "phoneCode": "+251",
    "states": [
      "Addis Ababa",
      "Oromia",
      "Amhara",
      "Tigray",
      "Sidama",
      "Somali"
    ]
  },
  {
    "code": "FJ",
    "name": "Fiji",
    "flag": "🇫🇯",
    "phoneCode": "+679",
    "states": [
      "Central (Suva)",
      "Western (Nadi)",
      "Northern",
      "Eastern"
    ]
  },
  {
    "code": "FI",
    "name": "Finland",
    "flag": "🇫🇮",
    "phoneCode": "+358",
    "states": [
      "Uusimaa (Helsinki)",
      "Pirkanmaa (Tampere)",
      "Southwest Finland (Turku)",
      "North Ostrobothnia (Oulu)"
    ]
  },
  {
    "code": "FR",
    "name": "France",
    "flag": "🇫🇷",
    "phoneCode": "+33",
    "states": [
      "Ile-de-France (Paris)",
      "Auvergne-Rhone-Alpes (Lyon)",
      "Provence-Alpes-Cote d'Azur (Marseille)",
      "Occitanie",
      "Nouvelle-Aquitaine"
    ]
  },
  {
    "code": "GA",
    "name": "Gabon",
    "flag": "🇬🇦",
    "phoneCode": "+241",
    "states": [
      "Estuaire (Libreville)",
      "Haut-Ogooue",
      "Ogooue-Maritime (Port-Gentil)"
    ]
  },
  {
    "code": "GM",
    "name": "Gambia",
    "flag": "🇬🇲",
    "phoneCode": "+220",
    "states": [
      "Banjul",
      "Kanifing",
      "West Coast",
      "North Bank"
    ]
  },
  {
    "code": "GE",
    "name": "Georgia",
    "flag": "🇬🇪",
    "phoneCode": "+995",
    "states": [
      "Tbilisi",
      "Adjara (Batumi)",
      "Imereti (Kutaisi)",
      "Kvemo Kartli"
    ]
  },
  {
    "code": "GH",
    "name": "Ghana",
    "flag": "🇬🇭",
    "phoneCode": "+233",
    "states": [
      "Greater Accra",
      "Ashanti (Kumasi)",
      "Western",
      "Eastern",
      "Central",
      "Northern (Tamale)"
    ]
  },
  {
    "code": "GR",
    "name": "Greece",
    "flag": "🇬🇷",
    "phoneCode": "+30",
    "states": [
      "Attica (Athens)",
      "Central Macedonia (Thessaloniki)",
      "Crete",
      "Western Greece",
      "South Aegean"
    ]
  },
  {
    "code": "GD",
    "name": "Grenada",
    "flag": "🇬🇩",
    "phoneCode": "+1-473",
    "states": [
      "Saint George",
      "Saint Andrew",
      "Carriacou and Petite Martinique"
    ]
  },
  {
    "code": "GT",
    "name": "Guatemala",
    "flag": "🇬🇹",
    "phoneCode": "+502",
    "states": [
      "Guatemala Department",
      "Mixco",
      "Villa Nueva",
      "Quetzaltenango"
    ]
  },
  {
    "code": "GN",
    "name": "Guinea",
    "flag": "🇬🇳",
    "phoneCode": "+224",
    "states": [
      "Conakry",
      "Nzerekore",
      "Kankan",
      "Kindia"
    ]
  },
  {
    "code": "GW",
    "name": "Guinea-Bissau",
    "flag": "🇬🇼",
    "phoneCode": "+245",
    "states": [
      "Bissau",
      "Bafata",
      "Gabu",
      "Cacheu"
    ]
  },
  {
    "code": "GY",
    "name": "Guyana",
    "flag": "🇬🇾",
    "phoneCode": "+592",
    "states": [
      "Demerara-Mahaica (Georgetown)",
      "Berbice",
      "Essequibo Islands"
    ]
  },
  {
    "code": "HT",
    "name": "Haiti",
    "flag": "🇭🇹",
    "phoneCode": "+509",
    "states": [
      "Ouest (Port-au-Prince)",
      "Artibonite",
      "Nord (Cap-Haitien)"
    ]
  },
  {
    "code": "HN",
    "name": "Honduras",
    "flag": "🇭🇳",
    "phoneCode": "+504",
    "states": [
      "Francisco Morazan (Tegucigalpa)",
      "Cortes (San Pedro Sula)",
      "Atlantida"
    ]
  },
  {
    "code": "HK",
    "name": "Hong Kong",
    "flag": "🇭🇰",
    "phoneCode": "+852",
    "states": [
      "Hong Kong Island",
      "Kowloon",
      "New Territories",
      "Lantau Island"
    ]
  },
  {
    "code": "HU",
    "name": "Hungary",
    "flag": "🇭🇺",
    "phoneCode": "+36",
    "states": [
      "Budapest",
      "Pest",
      "Borsod-Abauj-Zemplen",
      "Hajdu-Bihar (Debrecen)"
    ]
  },
  {
    "code": "IS",
    "name": "Iceland",
    "flag": "🇮🇸",
    "phoneCode": "+354",
    "states": [
      "Capital Region (Reykjavik)",
      "Southern Peninsula",
      "Northeastern",
      "Southern"
    ]
  },
  {
    "code": "ID",
    "name": "Indonesia",
    "flag": "🇮🇩",
    "phoneCode": "+62",
    "states": [
      "Jakarta",
      "West Java (Bandung)",
      "East Java (Surabaya)",
      "Central Java",
      "Bali",
      "North Sumatra (Medan)",
      "Banten"
    ]
  },
  {
    "code": "IR",
    "name": "Iran",
    "flag": "🇮🇷",
    "phoneCode": "+98",
    "states": [
      "Tehran",
      "Razavi Khorasan (Mashhad)",
      "Isfahan",
      "Fars (Shiraz)",
      "East Azerbaijan (Tabriz)"
    ]
  },
  {
    "code": "IQ",
    "name": "Iraq",
    "flag": "🇮🇶",
    "phoneCode": "+964",
    "states": [
      "Baghdad",
      "Basra",
      "Erbil",
      "Sulaymaniyah",
      "Nineveh (Mosul)",
      "Najaf",
      "Karbala"
    ]
  },
  {
    "code": "IE",
    "name": "Ireland",
    "flag": "🇮🇪",
    "phoneCode": "+353",
    "states": [
      "Dublin",
      "Cork",
      "Galway",
      "Limerick",
      "Waterford",
      "Kildare"
    ]
  },
  {
    "code": "IL",
    "name": "Israel",
    "flag": "🇮🇱",
    "phoneCode": "+972",
    "states": [
      "Tel Aviv",
      "Jerusalem",
      "Central District",
      "Haifa",
      "Northern District",
      "Southern District"
    ]
  },
  {
    "code": "IT",
    "name": "Italy",
    "flag": "🇮🇹",
    "phoneCode": "+39",
    "states": [
      "Lombardy (Milan)",
      "Lazio (Rome)",
      "Campania (Naples)",
      "Veneto (Venice)",
      "Piedmont (Turin)",
      "Tuscany (Florence)",
      "Emilia-Romagna"
    ]
  },
  {
    "code": "CI",
    "name": "Ivory Coast",
    "flag": "🇨🇮",
    "phoneCode": "+225",
    "states": [
      "Abidjan",
      "Yamoussoukro",
      "Bouake",
      "San Pedro",
      "Daloa"
    ]
  },
  {
    "code": "JM",
    "name": "Jamaica",
    "flag": "🇯🇲",
    "phoneCode": "+1-876",
    "states": [
      "Kingston",
      "Saint Andrew",
      "Saint Catherine",
      "Saint James (Montego Bay)"
    ]
  },
  {
    "code": "JP",
    "name": "Japan",
    "flag": "🇯🇵",
    "phoneCode": "+81",
    "states": [
      "Tokyo",
      "Osaka",
      "Kanagawa (Yokohama)",
      "Aichi (Nagoya)",
      "Hokkaido (Sapporo)",
      "Fukuoka",
      "Kyoto",
      "Hyogo (Kobe)"
    ]
  },
  {
    "code": "JO",
    "name": "Jordan",
    "flag": "🇯🇴",
    "phoneCode": "+962",
    "states": [
      "Amman",
      "Zarqa",
      "Irbid",
      "Aqaba",
      "Balqa"
    ]
  },
  {
    "code": "KZ",
    "name": "Kazakhstan",
    "flag": "🇰🇿",
    "phoneCode": "+7",
    "states": [
      "Almaty",
      "Astana",
      "Shymkent",
      "Karaganda",
      "Aktobe",
      "Atyrau"
    ]
  },
  {
    "code": "KE",
    "name": "Kenya",
    "flag": "🇰🇪",
    "phoneCode": "+254",
    "states": [
      "Nairobi",
      "Mombasa",
      "Kisumu",
      "Nakuru",
      "Kiambu",
      "Machakos"
    ]
  },
  {
    "code": "KI",
    "name": "Kiribati",
    "flag": "🇰🇮",
    "phoneCode": "+686",
    "states": [
      "South Tarawa",
      "Betio",
      "Bikenibeu"
    ]
  },
  {
    "code": "XK",
    "name": "Kosovo",
    "flag": "🇽🇰",
    "phoneCode": "+383",
    "states": [
      "Pristina",
      "Prizren",
      "Peja",
      "Gjakova",
      "Ferizaj"
    ]
  },
  {
    "code": "KG",
    "name": "Kyrgyzstan",
    "flag": "🇰🇬",
    "phoneCode": "+996",
    "states": [
      "Bishkek",
      "Osh",
      "Chuy",
      "Jalal-Abad",
      "Issyk-Kul"
    ]
  },
  {
    "code": "LA",
    "name": "Laos",
    "flag": "🇱🇦",
    "phoneCode": "+856",
    "states": [
      "Vientiane",
      "Champasak",
      "Luang Prabang",
      "Savannakhet"
    ]
  },
  {
    "code": "LV",
    "name": "Latvia",
    "flag": "🇱🇻",
    "phoneCode": "+371",
    "states": [
      "Riga",
      "Daugavpils",
      "Liepaja",
      "Jelgava",
      "Jurmala"
    ]
  },
  {
    "code": "LB",
    "name": "Lebanon",
    "flag": "🇱🇧",
    "phoneCode": "+961",
    "states": [
      "Beirut",
      "Mount Lebanon",
      "North Lebanon (Tripoli)",
      "South Lebanon (Sidon)",
      "Bekaa"
    ]
  },
  {
    "code": "LS",
    "name": "Lesotho",
    "flag": "🇱🇸",
    "phoneCode": "+266",
    "states": [
      "Maseru",
      "Berea",
      "Leribe",
      "Mafeteng"
    ]
  },
  {
    "code": "LR",
    "name": "Liberia",
    "flag": "🇱🇷",
    "phoneCode": "+231",
    "states": [
      "Montserrado (Monrovia)",
      "Nimba",
      "Bong",
      "Grand Bassa"
    ]
  },
  {
    "code": "LY",
    "name": "Libya",
    "flag": "🇱🇾",
    "phoneCode": "+218",
    "states": [
      "Tripoli",
      "Benghazi",
      "Misrata",
      "Zawiya",
      "Bayda"
    ]
  },
  {
    "code": "LI",
    "name": "Liechtenstein",
    "flag": "🇱🇮",
    "phoneCode": "+423",
    "states": [
      "Vaduz",
      "Schaan",
      "Balzers",
      "Triesen"
    ]
  },
  {
    "code": "LT",
    "name": "Lithuania",
    "flag": "🇱🇹",
    "phoneCode": "+370",
    "states": [
      "Vilnius",
      "Kaunas",
      "Klaipeda",
      "Siauliai",
      "Panevezys"
    ]
  },
  {
    "code": "LU",
    "name": "Luxembourg",
    "flag": "🇱🇺",
    "phoneCode": "+352",
    "states": [
      "Luxembourg City",
      "Esch-sur-Alzette",
      "Differdange",
      "Dudelange"
    ]
  },
  {
    "code": "MO",
    "name": "Macau",
    "flag": "🇲🇴",
    "phoneCode": "+853",
    "states": [
      "Macau Peninsula",
      "Taipa",
      "Cotai",
      "Coloane"
    ]
  },
  {
    "code": "MG",
    "name": "Madagascar",
    "flag": "🇲🇬",
    "phoneCode": "+261",
    "states": [
      "Analamanga (Antananarivo)",
      "Atsinanana (Toamasina)",
      "Vakinankaratra"
    ]
  },
  {
    "code": "MW",
    "name": "Malawi",
    "flag": "🇲🇼",
    "phoneCode": "+265",
    "states": [
      "Lilongwe",
      "Blantyre",
      "Mzuzu",
      "Zomba"
    ]
  },
  {
    "code": "MV",
    "name": "Maldives",
    "flag": "🇲🇻",
    "phoneCode": "+960",
    "states": [
      "Male City",
      "Hulhumale",
      "Addu City",
      "Fuvahmulah",
      "Kulhudhuffushi"
    ]
  },
  {
    "code": "ML",
    "name": "Mali",
    "flag": "🇲🇱",
    "phoneCode": "+223",
    "states": [
      "Bamako",
      "Sikasso",
      "Koulikoro",
      "Segou",
      "Kayes"
    ]
  },
  {
    "code": "MT",
    "name": "Malta",
    "flag": "🇲🇹",
    "phoneCode": "+356",
    "states": [
      "Valletta",
      "Birkirkara",
      "Sliema",
      "Mosta",
      "St. Paul's Bay",
      "Gozo"
    ]
  },
  {
    "code": "MH",
    "name": "Marshall Islands",
    "flag": "🇲🇭",
    "phoneCode": "+692",
    "states": [
      "Majuro",
      "Kwajalein",
      "Arno"
    ]
  },
  {
    "code": "MR",
    "name": "Mauritania",
    "flag": "🇲🇷",
    "phoneCode": "+222",
    "states": [
      "Nouakchott",
      "Nouadhibou",
      "Trarza",
      "Hodh Ech Chargui"
    ]
  },
  {
    "code": "MU",
    "name": "Mauritius",
    "flag": "🇲🇺",
    "phoneCode": "+230",
    "states": [
      "Port Louis",
      "Plaines Wilhems",
      "Pamplemousses",
      "Flacq",
      "Black River"
    ]
  },
  {
    "code": "MX",
    "name": "Mexico",
    "flag": "🇲🇽",
    "phoneCode": "+52",
    "states": [
      "Mexico City",
      "Jalisco (Guadalajara)",
      "Nuevo Leon (Monterrey)",
      "Puebla",
      "Guanajuato",
      "Veracruz",
      "Yucatan (Merida)",
      "Quintana Roo (Cancun)"
    ]
  },
  {
    "code": "FM",
    "name": "Micronesia",
    "flag": "🇫🇲",
    "phoneCode": "+691",
    "states": [
      "Pohnpei",
      "Chuuk",
      "Yap",
      "Kosrae"
    ]
  },
  {
    "code": "MD",
    "name": "Moldova",
    "flag": "🇲🇩",
    "phoneCode": "+373",
    "states": [
      "Chisinau",
      "Balti",
      "Tiraspol",
      "Cahul"
    ]
  },
  {
    "code": "MC",
    "name": "Monaco",
    "flag": "🇲🇨",
    "phoneCode": "+377",
    "states": [
      "Monte Carlo",
      "La Condamine",
      "Monaco-Ville",
      "Fontvieille"
    ]
  },
  {
    "code": "MN",
    "name": "Mongolia",
    "flag": "🇲🇳",
    "phoneCode": "+976",
    "states": [
      "Ulaanbaatar",
      "Erdenet",
      "Darkhan",
      "Orkhon"
    ]
  },
  {
    "code": "ME",
    "name": "Montenegro",
    "flag": "🇲🇪",
    "phoneCode": "+382",
    "states": [
      "Podgorica",
      "Niksic",
      "Herceg Novi",
      "Budva",
      "Bar"
    ]
  },
  {
    "code": "MA",
    "name": "Morocco",
    "flag": "🇲🇦",
    "phoneCode": "+212",
    "states": [
      "Casablanca-Settat",
      "Rabat-Sale-Kenitra",
      "Marrakech-Safi",
      "Tanger-Tetouan-Al Hoceima",
      "Fes-Meknes",
      "Agadir"
    ]
  },
  {
    "code": "MZ",
    "name": "Mozambique",
    "flag": "🇲🇿",
    "phoneCode": "+258",
    "states": [
      "Maputo City",
      "Nampula",
      "Zambezia",
      "Sofala (Beira)"
    ]
  },
  {
    "code": "MM",
    "name": "Myanmar",
    "flag": "🇲🇲",
    "phoneCode": "+95",
    "states": [
      "Yangon",
      "Mandalay",
      "Naypyidaw",
      "Bago",
      "Shan State"
    ]
  },
  {
    "code": "NA",
    "name": "Namibia",
    "flag": "🇳🇦",
    "phoneCode": "+264",
    "states": [
      "Khomas (Windhoek)",
      "Erongo (Walvis Bay)",
      "Oshana",
      "Otjozondjupa"
    ]
  },
  {
    "code": "NR",
    "name": "Nauru",
    "flag": "🇳🇷",
    "phoneCode": "+674",
    "states": [
      "Yaren",
      "Boe",
      "Aiwo",
      "Anabar"
    ]
  },
  {
    "code": "NP",
    "name": "Nepal",
    "flag": "🇳🇵",
    "phoneCode": "+977",
    "states": [
      "Bagmati (Kathmandu)",
      "Gandaki (Pokhara)",
      "Lumbini",
      "Koshi",
      "Madhesh",
      "Sudurpashchim"
    ]
  },
  {
    "code": "NL",
    "name": "Netherlands",
    "flag": "🇳🇱",
    "phoneCode": "+31",
    "states": [
      "North Holland (Amsterdam)",
      "South Holland (Rotterdam / The Hague)",
      "Utrecht",
      "North Brabant (Eindhoven)",
      "Gelderland"
    ]
  },
  {
    "code": "NZ",
    "name": "New Zealand",
    "flag": "🇳🇿",
    "phoneCode": "+64",
    "states": [
      "Auckland",
      "Wellington",
      "Canterbury (Christchurch)",
      "Waikato (Hamilton)",
      "Bay of Plenty",
      "Otago (Dunedin)"
    ]
  },
  {
    "code": "NI",
    "name": "Nicaragua",
    "flag": "🇳🇮",
    "phoneCode": "+505",
    "states": [
      "Managua",
      "Leon",
      "Chinandega",
      "Matagalpa"
    ]
  },
  {
    "code": "NE",
    "name": "Niger",
    "flag": "🇳🇪",
    "phoneCode": "+227",
    "states": [
      "Niamey",
      "Zinder",
      "Maradi",
      "Tahoua",
      "Agadez"
    ]
  },
  {
    "code": "NG",
    "name": "Nigeria",
    "flag": "🇳🇬",
    "phoneCode": "+234",
    "states": [
      "Lagos",
      "Kano",
      "Abuja (FCT)",
      "Rivers (Port Harcourt)",
      "Oyo (Ibadan)",
      "Kaduna",
      "Enugu",
      "Anambra"
    ]
  },
  {
    "code": "KP",
    "name": "North Korea",
    "flag": "🇰🇵",
    "phoneCode": "+850",
    "states": [
      "Pyongyang",
      "Hamhung",
      "Chongjin",
      "Nampo"
    ]
  },
  {
    "code": "MK",
    "name": "North Macedonia",
    "flag": "🇲🇰",
    "phoneCode": "+389",
    "states": [
      "Skopje",
      "Bitola",
      "Kumanovo",
      "Prilep",
      "Tetovo"
    ]
  },
  {
    "code": "NO",
    "name": "Norway",
    "flag": "🇳🇴",
    "phoneCode": "+47",
    "states": [
      "Oslo",
      "Viken",
      "Vestland (Bergen)",
      "Trondelag (Trondheim)",
      "Rogaland (Stavanger)"
    ]
  },
  {
    "code": "PW",
    "name": "Palau",
    "flag": "🇵🇼",
    "phoneCode": "+680",
    "states": [
      "Koror",
      "Airai",
      "Melekeok (Ngerulmud)"
    ]
  },
  {
    "code": "PS",
    "name": "Palestine",
    "flag": "🇵🇸",
    "phoneCode": "+970",
    "states": [
      "West Bank (Ramallah)",
      "Jerusalem (Al-Quds)",
      "Gaza",
      "Hebron",
      "Nablus",
      "Bethlehem"
    ]
  },
  {
    "code": "PA",
    "name": "Panama",
    "flag": "🇵🇦",
    "phoneCode": "+507",
    "states": [
      "Panama City",
      "Panama Oeste",
      "Colon",
      "Chiriqui (David)"
    ]
  },
  {
    "code": "PG",
    "name": "Papua New Guinea",
    "flag": "🇵🇬",
    "phoneCode": "+675",
    "states": [
      "National Capital District (Port Moresby)",
      "Morobe (Lae)",
      "Eastern Highlands"
    ]
  },
  {
    "code": "PY",
    "name": "Paraguay",
    "flag": "🇵🇾",
    "phoneCode": "+595",
    "states": [
      "Asuncion",
      "Central",
      "Alto Parana (Ciudad del Este)",
      "Itapua"
    ]
  },
  {
    "code": "PE",
    "name": "Peru",
    "flag": "🇵🇪",
    "phoneCode": "+51",
    "states": [
      "Lima",
      "Arequipa",
      "La Libertad (Trujillo)",
      "Piura",
      "Cusco"
    ]
  },
  {
    "code": "PH",
    "name": "Philippines",
    "flag": "🇵🇭",
    "phoneCode": "+63",
    "states": [
      "Metro Manila",
      "Cebu",
      "Davao",
      "Calabarzon",
      "Central Luzon",
      "Iloilo"
    ]
  },
  {
    "code": "PL",
    "name": "Poland",
    "flag": "🇵🇱",
    "phoneCode": "+48",
    "states": [
      "Masovia (Warsaw)",
      "Lesser Poland (Krakow)",
      "Lower Silesia (Wroclaw)",
      "Greater Poland (Poznan)",
      "Silesia (Katowice)"
    ]
  },
  {
    "code": "PT",
    "name": "Portugal",
    "flag": "🇵🇹",
    "phoneCode": "+351",
    "states": [
      "Lisbon",
      "Porto",
      "Braga",
      "Setubal",
      "Faro (Algarve)",
      "Madeira",
      "Azores"
    ]
  },
  {
    "code": "RO",
    "name": "Romania",
    "flag": "🇷🇴",
    "phoneCode": "+40",
    "states": [
      "Bucharest",
      "Cluj",
      "Timis (Timisoara)",
      "Iasi",
      "Constanta",
      "Brasov"
    ]
  },
  {
    "code": "RU",
    "name": "Russia",
    "flag": "🇷🇺",
    "phoneCode": "+7",
    "states": [
      "Moscow",
      "Saint Petersburg",
      "Novosibirsk",
      "Yekaterinburg",
      "Kazan",
      "Nizhny Novgorod",
      "Chelyabinsk",
      "Samara"
    ]
  },
  {
    "code": "RW",
    "name": "Rwanda",
    "flag": "🇷🇼",
    "phoneCode": "+250",
    "states": [
      "Kigali",
      "Southern Province",
      "Western Province",
      "Northern Province",
      "Eastern Province"
    ]
  },
  {
    "code": "KN",
    "name": "Saint Kitts and Nevis",
    "flag": "🇰🇳",
    "phoneCode": "+1-869",
    "states": [
      "Saint George Basseterre",
      "Saint Peter",
      "Nevis"
    ]
  },
  {
    "code": "LC",
    "name": "Saint Lucia",
    "flag": "🇱🇨",
    "phoneCode": "+1-758",
    "states": [
      "Castries",
      "Gros Islet",
      "Vieux Fort"
    ]
  },
  {
    "code": "VC",
    "name": "Saint Vincent and the Grenadines",
    "flag": "🇻🇨",
    "phoneCode": "+1-784",
    "states": [
      "Saint George (Kingstown)",
      "Charlotte",
      "Grenadines"
    ]
  },
  {
    "code": "WS",
    "name": "Samoa",
    "flag": "🇼🇸",
    "phoneCode": "+685",
    "states": [
      "Tuamasaga (Apia)",
      "Aana",
      "Atua"
    ]
  },
  {
    "code": "SM",
    "name": "San Marino",
    "flag": "🇸🇲",
    "phoneCode": "+378",
    "states": [
      "City of San Marino",
      "Serravalle",
      "Borgo Maggiore"
    ]
  },
  {
    "code": "ST",
    "name": "Sao Tome and Principe",
    "flag": "🇸🇹",
    "phoneCode": "+239",
    "states": [
      "Sao Tome",
      "Principe",
      "Me-Zochi"
    ]
  },
  {
    "code": "SN",
    "name": "Senegal",
    "flag": "🇸🇳",
    "phoneCode": "+221",
    "states": [
      "Dakar",
      "Thies",
      "Diourbel",
      "Saint-Louis",
      "Ziguinchor"
    ]
  },
  {
    "code": "RS",
    "name": "Serbia",
    "flag": "🇷🇸",
    "phoneCode": "+381",
    "states": [
      "Belgrade",
      "Novi Sad",
      "Nis",
      "Kragujevac",
      "Subotica"
    ]
  },
  {
    "code": "SC",
    "name": "Seychelles",
    "flag": "🇸🇨",
    "phoneCode": "+248",
    "states": [
      "Mahe (Victoria)",
      "Praslin",
      "La Digue"
    ]
  },
  {
    "code": "SL",
    "name": "Sierra Leone",
    "flag": "🇸🇱",
    "phoneCode": "+232",
    "states": [
      "Western Area (Freetown)",
      "Northern",
      "Southern (Bo)",
      "Eastern (Kenema)"
    ]
  },
  {
    "code": "SK",
    "name": "Slovakia",
    "flag": "🇸🇰",
    "phoneCode": "+421",
    "states": [
      "Bratislava",
      "Kosice",
      "Presov",
      "Zilina",
      "Nitra",
      "Banska Bystrica"
    ]
  },
  {
    "code": "SI",
    "name": "Slovenia",
    "flag": "🇸🇮",
    "phoneCode": "+386",
    "states": [
      "Ljubljana",
      "Maribor",
      "Kranj",
      "Koper",
      "Celje"
    ]
  },
  {
    "code": "SB",
    "name": "Solomon Islands",
    "flag": "🇸🇧",
    "phoneCode": "+677",
    "states": [
      "Honiara (Guadalcanal)",
      "Malaita",
      "Western Province"
    ]
  },
  {
    "code": "SO",
    "name": "Somalia",
    "flag": "🇸🇴",
    "phoneCode": "+252",
    "states": [
      "Banaadir (Mogadishu)",
      "Hiran",
      "Lower Shabelle",
      "Puntland (Garowe)",
      "Somaliland (Hargeisa)"
    ]
  },
  {
    "code": "ZA",
    "name": "South Africa",
    "flag": "🇿🇦",
    "phoneCode": "+27",
    "states": [
      "Gauteng (Johannesburg / Pretoria)",
      "Western Cape (Cape Town)",
      "KwaZulu-Natal (Durban)",
      "Eastern Cape",
      "Free State"
    ]
  },
  {
    "code": "KR",
    "name": "South Korea",
    "flag": "🇰🇷",
    "phoneCode": "+82",
    "states": [
      "Seoul",
      "Gyeonggi-do",
      "Busan",
      "Incheon",
      "Daegu",
      "Daejeon",
      "Gwangju",
      "Jeju"
    ]
  },
  {
    "code": "SS",
    "name": "South Sudan",
    "flag": "🇸🇸",
    "phoneCode": "+211",
    "states": [
      "Central Equatoria (Juba)",
      "Jonglei",
      "Upper Nile",
      "Western Bahr el Ghazal"
    ]
  },
  {
    "code": "ES",
    "name": "Spain",
    "flag": "🇪🇸",
    "phoneCode": "+34",
    "states": [
      "Madrid",
      "Catalonia (Barcelona)",
      "Andalusia (Seville / Malaga)",
      "Valencia",
      "Basque Country",
      "Galicia",
      "Canary Islands",
      "Balearic Islands"
    ]
  },
  {
    "code": "LK",
    "name": "Sri Lanka",
    "flag": "🇱🇰",
    "phoneCode": "+94",
    "states": [
      "Western (Colombo)",
      "Central (Kandy)",
      "Southern (Galle)",
      "Northern (Jaffna)",
      "Eastern",
      "North Western"
    ]
  },
  {
    "code": "SD",
    "name": "Sudan",
    "flag": "🇸🇩",
    "phoneCode": "+249",
    "states": [
      "Khartoum",
      "Gezira",
      "Red Sea (Port Sudan)",
      "Kassala",
      "North Darfur"
    ]
  },
  {
    "code": "SR",
    "name": "Suriname",
    "flag": "🇸🇷",
    "phoneCode": "+597",
    "states": [
      "Paramaribo",
      "Wanica",
      "Nickerie",
      "Commewijne"
    ]
  },
  {
    "code": "SE",
    "name": "Sweden",
    "flag": "🇸🇪",
    "phoneCode": "+46",
    "states": [
      "Stockholm",
      "Vastra Gotaland (Gothenburg)",
      "Skane (Malmo)",
      "Uppsala",
      "Ostergotland"
    ]
  },
  {
    "code": "CH",
    "name": "Switzerland",
    "flag": "🇨🇭",
    "phoneCode": "+41",
    "states": [
      "Zurich",
      "Geneva",
      "Vaud (Lausanne)",
      "Bern",
      "Basel-Stadt",
      "Lucerne",
      "Ticino (Lugano)"
    ]
  },
  {
    "code": "SY",
    "name": "Syria",
    "flag": "🇸🇾",
    "phoneCode": "+963",
    "states": [
      "Damascus",
      "Aleppo",
      "Homs",
      "Latakia",
      "Hama",
      "Tartus"
    ]
  },
  {
    "code": "TW",
    "name": "Taiwan",
    "flag": "🇹🇼",
    "phoneCode": "+886",
    "states": [
      "Taipei",
      "New Taipei",
      "Kaohsiung",
      "Taichung",
      "Taoyuan",
      "Tainan"
    ]
  },
  {
    "code": "TJ",
    "name": "Tajikistan",
    "flag": "🇹🇯",
    "phoneCode": "+992",
    "states": [
      "Dushanbe",
      "Sughd (Khujand)",
      "Khatlon",
      "Gorno-Badakhshan"
    ]
  },
  {
    "code": "TZ",
    "name": "Tanzania",
    "flag": "🇹🇿",
    "phoneCode": "+255",
    "states": [
      "Dar es Salaam",
      "Dodoma",
      "Mwanza",
      "Arusha",
      "Zanzibar"
    ]
  },
  {
    "code": "TH",
    "name": "Thailand",
    "flag": "🇹🇭",
    "phoneCode": "+66",
    "states": [
      "Bangkok",
      "Chiang Mai",
      "Phuket",
      "Chonburi (Pattaya)",
      "Nakhon Ratchasima",
      "Songkhla (Hat Yai)"
    ]
  },
  {
    "code": "TL",
    "name": "Timor-Leste",
    "flag": "🇹🇱",
    "phoneCode": "+670",
    "states": [
      "Dili",
      "Baucau",
      "Ermera",
      "Bobonaro"
    ]
  },
  {
    "code": "TG",
    "name": "Togo",
    "flag": "🇹🇬",
    "phoneCode": "+228",
    "states": [
      "Maritime (Lome)",
      "Plateaux",
      "Centrale",
      "Kara",
      "Savanes"
    ]
  },
  {
    "code": "TO",
    "name": "Tonga",
    "flag": "🇹🇴",
    "phoneCode": "+676",
    "states": [
      "Tongatapu (Nuku'alofa)",
      "Vava'u",
      "Ha'apai"
    ]
  },
  {
    "code": "TT",
    "name": "Trinidad and Tobago",
    "flag": "🇹🇹",
    "phoneCode": "+1-868",
    "states": [
      "Port of Spain",
      "Chaguanas",
      "San Fernando",
      "Tobago"
    ]
  },
  {
    "code": "TN",
    "name": "Tunisia",
    "flag": "🇹🇳",
    "phoneCode": "+216",
    "states": [
      "Tunis",
      "Sfax",
      "Sousse",
      "Kairouan",
      "Bizerte",
      "Ariana"
    ]
  },
  {
    "code": "TM",
    "name": "Turkmenistan",
    "flag": "🇹🇲",
    "phoneCode": "+993",
    "states": [
      "Ashgabat",
      "Mary",
      "Lebap (Turkmenabat)",
      "Dashoguz",
      "Balkan (Turkmenbashi)"
    ]
  },
  {
    "code": "TV",
    "name": "Tuvalu",
    "flag": "🇹🇻",
    "phoneCode": "+688",
    "states": [
      "Funafuti",
      "Nanumea",
      "Nui"
    ]
  },
  {
    "code": "UG",
    "name": "Uganda",
    "flag": "🇺🇬",
    "phoneCode": "+256",
    "states": [
      "Central (Kampala)",
      "Wakiso",
      "Western (Mbarara)",
      "Eastern (Jinja)",
      "Northern (Gulu)"
    ]
  },
  {
    "code": "UA",
    "name": "Ukraine",
    "flag": "🇺🇦",
    "phoneCode": "+380",
    "states": [
      "Kyiv",
      "Kharkiv",
      "Odesa",
      "Dnipro",
      "Lviv",
      "Zaporizhzhia"
    ]
  },
  {
    "code": "UY",
    "name": "Uruguay",
    "flag": "🇺🇾",
    "phoneCode": "+598",
    "states": [
      "Montevideo",
      "Canelones",
      "Maldonado (Punta del Este)",
      "Salto",
      "Colonia"
    ]
  },
  {
    "code": "UZ",
    "name": "Uzbekistan",
    "flag": "🇺🇿",
    "phoneCode": "+998",
    "states": [
      "Tashkent",
      "Samarkand",
      "Bukhara",
      "Fergana",
      "Andijan",
      "Namangan"
    ]
  },
  {
    "code": "VU",
    "name": "Vanuatu",
    "flag": "🇻🇺",
    "phoneCode": "+678",
    "states": [
      "Shefa (Port Vila)",
      "Sanma (Luganville)",
      "Malampa"
    ]
  },
  {
    "code": "VA",
    "name": "Vatican City",
    "flag": "🇻🇦",
    "phoneCode": "+379",
    "states": [
      "Vatican City"
    ]
  },
  {
    "code": "VE",
    "name": "Venezuela",
    "flag": "🇻🇪",
    "phoneCode": "+58",
    "states": [
      "Caracas (Capital)",
      "Zulia (Maracaibo)",
      "Miranda",
      "Carabobo (Valencia)",
      "Lara (Barquisimeto)"
    ]
  },
  {
    "code": "VN",
    "name": "Vietnam",
    "flag": "🇻🇳",
    "phoneCode": "+84",
    "states": [
      "Ho Chi Minh City",
      "Hanoi",
      "Da Nang",
      "Hai Phong",
      "Can Tho",
      "Binh Duong",
      "Dong Nai"
    ]
  },
  {
    "code": "YE",
    "name": "Yemen",
    "flag": "🇾🇪",
    "phoneCode": "+967",
    "states": [
      "Sana'a",
      "Aden",
      "Taiz",
      "Al Hudaydah",
      "Ibb",
      "Hadhramaut"
    ]
  },
  {
    "code": "ZM",
    "name": "Zambia",
    "flag": "🇿🇲",
    "phoneCode": "+260",
    "states": [
      "Lusaka",
      "Copperbelt (Ndola / Kitwe)",
      "Central",
      "Southern (Livingstone)"
    ]
  },
  {
    "code": "ZW",
    "name": "Zimbabwe",
    "flag": "🇿🇼",
    "phoneCode": "+263",
    "states": [
      "Harare",
      "Bulawayo",
      "Manicaland",
      "Midlands",
      "Masvingo"
    ]
  },
  {
    "code": "PR",
    "name": "Puerto Rico",
    "flag": "🇵🇷",
    "phoneCode": "+1-787",
    "states": [
      "San Juan",
      "Bayamon",
      "Carolina",
      "Ponce",
      "Caguas"
    ]
  },
  {
    "code": "BM",
    "name": "Bermuda",
    "flag": "🇧🇲",
    "phoneCode": "+1-441",
    "states": [
      "Hamilton",
      "Saint George",
      "Pembroke"
    ]
  },
  {
    "code": "KY",
    "name": "Cayman Islands",
    "flag": "🇰🇾",
    "phoneCode": "+1-345",
    "states": [
      "George Town",
      "West Bay",
      "Bodden Town"
    ]
  },
  {
    "code": "GL",
    "name": "Greenland",
    "flag": "🇬🇱",
    "phoneCode": "+299",
    "states": [
      "Sermersooq (Nuuk)",
      "Avannaata",
      "Qeqertalik"
    ]
  },
  {
    "code": "GU",
    "name": "Guam",
    "flag": "🇬🇺",
    "phoneCode": "+1-671",
    "states": [
      "Dededo",
      "Yigo",
      "Tamuning",
      "Hagatna"
    ]
  },
  {
    "code": "GI",
    "name": "Gibraltar",
    "flag": "🇬🇮",
    "phoneCode": "+350",
    "states": [
      "Gibraltar"
    ]
  },
  {
    "code": "IM",
    "name": "Isle of Man",
    "flag": "🇮🇲",
    "phoneCode": "+44",
    "states": [
      "Douglas",
      "Onchan",
      "Ramsey",
      "Peel"
    ]
  },
  {
    "code": "JE",
    "name": "Jersey",
    "flag": "🇯🇪",
    "phoneCode": "+44",
    "states": [
      "Saint Helier",
      "Saint Saviour",
      "Saint Brelade"
    ]
  },
  {
    "code": "GG",
    "name": "Guernsey",
    "flag": "🇬🇬",
    "phoneCode": "+44",
    "states": [
      "Saint Peter Port",
      "Vale",
      "Castel"
    ]
  },
  {
    "code": "FO",
    "name": "Faroe Islands",
    "flag": "🇫🇴",
    "phoneCode": "+298",
    "states": [
      "Torshavn",
      "Klaksvik",
      "Runavik"
    ]
  },
  {
    "code": "AW",
    "name": "Aruba",
    "flag": "🇦🇼",
    "phoneCode": "+297",
    "states": [
      "Oranjestad",
      "San Nicolaas",
      "Noord"
    ]
  },
  {
    "code": "CW",
    "name": "Curacao",
    "flag": "🇨🇼",
    "phoneCode": "+599",
    "states": [
      "Willemstad"
    ]
  },
  {
    "code": "PF",
    "name": "French Polynesia",
    "flag": "🇵🇫",
    "phoneCode": "+689",
    "states": [
      "Windward Islands (Tahiti)",
      "Leeward Islands (Bora Bora)",
      "Tuamotu"
    ]
  },
  {
    "code": "NC",
    "name": "New Caledonia",
    "flag": "🇳🇨",
    "phoneCode": "+687",
    "states": [
      "South Province (Noumea)",
      "North Province",
      "Loyalty Islands"
    ]
  },
  {
    "code": "SX",
    "name": "Sint Maarten",
    "flag": "🇸🇽",
    "phoneCode": "+1-721",
    "states": [
      "Philipsburg",
      "Cul de Sac",
      "Simpson Bay"
    ]
  },
  {
    "code": "TC",
    "name": "Turks and Caicos Islands",
    "flag": "🇹🇨",
    "phoneCode": "+1-649",
    "states": [
      "Providenciales",
      "Grand Turk",
      "North Caicos"
    ]
  },
  {
    "code": "VG",
    "name": "British Virgin Islands",
    "flag": "🇻🇬",
    "phoneCode": "+1-284",
    "states": [
      "Tortola (Road Town)",
      "Virgin Gorda",
      "Anegada"
    ]
  },
  {
    "code": "VI",
    "name": "U.S. Virgin Islands",
    "flag": "🇻🇮",
    "phoneCode": "+1-340",
    "states": [
      "Saint Thomas (Charlotte Amalie)",
      "Saint Croix",
      "Saint John"
    ]
  }
];

/** Alphabetical countries; states A→Z. UI should start with empty "Select Country". */
export const COUNTRIES_DATA: CountryStateData[] = RAW_COUNTRIES_DATA
  .map((c) => ({
    ...c,
    states: [...c.states].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    )
  }))
  .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
