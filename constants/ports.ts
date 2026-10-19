// World ports for delivery port autocomplete.
// ~900 entries, curated from NGA World Port Index + UN/LOCODE.
// Free-text entry always allowed alongside this list.

const RAW: string[] = [
  // Netherlands
  'Rotterdam','Amsterdam','Ijmuiden','Vlissingen','Terneuzen','Moerdijk','Delfzijl',
  'Den Helder','Harlingen','Schiedam','Dordrecht','Velsen','Zaandam','Europoort',
  'Flushing','Botlek',
  // Belgium
  'Antwerp','Ghent','Zeebrugge','Bruges','Liège',
  // Germany
  'Hamburg','Bremen','Bremerhaven','Rostock','Kiel','Lübeck','Wilhelmshaven',
  'Stralsund','Wismar','Flensburg','Emden','Brunsbüttel','Cuxhaven','Duisburg',
  'Greifswald','Sassnitz',
  // UK
  'London (Tilbury)','Southampton','Felixstowe','Liverpool','Glasgow','Bristol',
  'Portsmouth','Newcastle','Hull','Grimsby','Immingham','Grangemouth','Belfast',
  'Medway','Shoreham','Dover','Harwich','Ipswich','Sunderland','Middlesbrough',
  'Leith','Dundee','Greenock','Avonmouth','Portbury','Swansea','Newport','Cardiff',
  'Tyne','Tees','Aberdeen','Forth',
  // Ireland
  'Dublin','Cork','Waterford','Limerick','Galway','Drogheda','Rosslare',
  // France
  'Le Havre','Marseille','Dunkirk','Bordeaux','Nantes','Rouen','Brest','Calais',
  'Cherbourg','Bayonne','La Rochelle','Toulon','Nice','Sète','Lorient','Roscoff',
  'Saint-Malo','Caen','Dieppe','Fos-sur-Mer',
  // Norway
  'Oslo','Bergen','Stavanger','Kristiansand','Trondheim','Tromsø','Narvik',
  'Ålesund','Haugesund','Larvik','Drammen','Fredrikstad','Moss','Sandefjord',
  'Bodø','Hammerfest','Harstad','Molde','Kristiansund','Porsgrunn','Grenland',
  'Mongstad','Karmsund',
  // Sweden
  'Gothenburg','Stockholm','Malmö','Helsingborg','Gävle','Norrköping','Oxelösund',
  'Luleå','Sundsvall','Umeå','Karlskrona','Halmstad','Kalmar','Västerås',
  'Stenungsund','Lysekil','Karlshamn','Södertälje','Brofjorden',
  // Denmark
  'Copenhagen','Aarhus','Fredericia','Esbjerg','Aalborg','Odense','Kalundborg',
  'Helsingør','Randers','Grenaa','Frederikshavn','Rønne','Vejle','Kolding',
  // Finland
  'Helsinki','Turku','Kotka','Hanko','Rauma','Pori','Vaasa','Oulu','Naantali',
  'Hamina','Inkoo','Kaskinen','HaminaKotka',
  // Estonia
  'Tallinn','Muuga','Paldiski','Sillamäe','Pärnu',
  // Latvia
  'Riga','Ventspils','Liepāja',
  // Lithuania
  'Klaipeda',
  // Poland
  'Gdansk','Gdynia','Szczecin','Świnoujście','Police',
  // Russia
  'St. Petersburg','Kaliningrad','Murmansk','Arkhangelsk','Novorossiysk',
  'Vladivostok','Nakhodka','Vanino','Vostochny','Primorsk','Ust-Luga',
  // Spain
  'Barcelona','Valencia','Algeciras','Bilbao','Cartagena','Tarragona','Vigo',
  'Huelva','Almería','Alicante','Palma','Las Palmas','Tenerife (Santa Cruz)',
  'Cádiz','Ferrol','Pasajes','Gijón','Avilés','Sagunto','Castellón',
  // Portugal
  'Lisbon','Porto','Sines','Setúbal','Leixões','Aveiro','Figueira da Foz',
  'Viana do Castelo','Portimão',
  // Italy
  'Genova','Trieste','Venice','Livorno','Civitavecchia','Naples','Palermo',
  'Gioia Tauro','Augusta','Ravenna','Ancona','Bari','Taranto','Cagliari',
  'La Spezia','Salerno','Brindisi','Catania','Messina',
  // Greece
  'Piraeus','Thessaloniki','Patras','Heraklion','Volos','Kavala',
  'Igoumenitsa','Alexandroupolis','Elefsina',
  // Turkey
  'Istanbul','Izmir','Mersin','İskenderun','Trabzon','Samsun','Gemlik',
  'Derince','Aliağa','Ambarlı','Kocaeli (İzmit)','Haydarpasa',
  // Croatia / Slovenia / Montenegro / Albania
  'Split','Rijeka','Zadar','Dubrovnik','Ploče','Šibenik',
  'Koper',
  'Bar',
  'Durrës','Vlorë',
  // Malta / Cyprus
  'Valletta','Marsaxlokk',
  'Limassol','Larnaca',
  // Israel / Lebanon / Syria
  'Haifa','Ashdod','Eilat',
  'Beirut',
  'Lattakia','Tartus',
  // Black Sea — Ukraine / Romania / Bulgaria / Georgia
  'Odessa','Chornomorsk','Yuzhne','Mariupol','Kherson','Nikolaev','Kerch',
  'Constanta','Galati','Braila','Tulcea',
  'Varna','Burgas',
  'Batumi','Poti',
  // North Africa
  'Alexandria','Port Said','Damietta','Suez',
  'Casablanca','Tangier Med','Agadir','Mohammedia','Safi','Nador',
  'Tunis','Bizerte','Sfax','Sousse','Gabes',
  'Algiers','Oran','Annaba','Skikda','Béjaïa',
  'Tripoli','Benghazi','Misrata',
  // East Africa / Red Sea
  'Port Sudan','Djibouti','Aden',
  'Mombasa','Dar es Salaam','Tanga','Zanzibar',
  'Maputo','Beira','Nacala',
  'Toamasina (Tamatave)',
  'Port Louis',
  // South Africa
  'Cape Town','Durban','Richards Bay','Gqeberha (Port Elizabeth)','East London',
  'Saldanha Bay',
  // West Africa
  'Lagos (Apapa)','Tin Can Island','Bonny','Onne','Calabar','Warri',
  'Tema','Takoradi',
  'Abidjan','San Pedro',
  'Lomé',
  'Cotonou',
  'Dakar',
  'Conakry','Freetown','Monrovia',
  'Luanda','Lobito',
  'Douala',
  'Walvis Bay',
  // Middle East
  'Jeddah','Dammam','Ras Tanura','Jubail','Yanbu','King Abdullah Port',
  'Dubai (Jebel Ali)','Abu Dhabi','Sharjah','Fujairah','Ras Al Khaimah',
  'Hamad Port (Qatar)','Shuaiba','Shuwaikh',
  'Umm Qasr','Basra',
  'Bandar Abbas','Bandar Imam Khomeini','Bushehr','Chabahar',
  'Muscat','Salalah','Sohar','Duqm',
  'Aqaba',
  'Hudaydah',
  // Indian Subcontinent
  'Mumbai','Nhava Sheva (JNPT)','Kandla','Mundra','Hazira','Pipavav',
  'Chennai','Tuticorin','Kolkata','Haldia','Visakhapatnam','Cochin',
  'Mangalore','Ennore','Paradip',
  'Karachi','Port Qasim','Gwadar',
  'Colombo','Hambantota',
  'Chittagong','Mongla',
  // Southeast Asia
  'Singapore',
  'Port Klang','Penang','Pasir Gudang','Tanjung Pelepas','Bintulu','Kuching',
  'Bangkok','Laem Chabang','Map Ta Phut',
  'Ho Chi Minh City','Haiphong','Da Nang','Cai Mep',
  'Jakarta (Tanjung Priok)','Surabaya','Makassar','Batam','Belawan',
  'Semarang','Balikpapan','Panjang','Dumai',
  'Manila','Cebu','Davao','Subic Bay','Batangas',
  'Sihanoukville',
  'Yangon',
  'Muara',
  // East Asia
  'Shanghai','Ningbo-Zhoushan','Shenzhen','Guangzhou (Nansha)','Tianjin',
  'Qingdao','Dalian','Xiamen','Fuzhou','Lianyungang','Nanjing','Yingkou',
  'Tangshan (Caofeidian)','Rizhao','Weifang','Yantai','Nantong','Zhanjiang',
  'Zhuhai','Huangpu','Longkou','Dongying',
  'Hong Kong',
  'Kaohsiung','Keelung','Taichung',
  'Busan','Incheon','Gwangyang','Ulsan','Pyeongtaek','Pohang',
  'Yokohama','Tokyo','Nagoya','Osaka','Kobe','Kitakyushu','Chiba',
  'Kawasaki','Niigata','Tomakomai','Muroran','Hakata',
  // Australia & New Zealand
  'Sydney','Melbourne','Brisbane','Fremantle','Adelaide','Darwin',
  'Port Hedland','Dampier','Gladstone','Mackay','Townsville','Newcastle (AU)',
  'Botany Bay','Geelong','Port Kembla',
  'Auckland','Tauranga','Wellington','Lyttelton','Napier','Nelson',
  // Pacific
  'Honolulu','Suva','Lautoka','Nouméa','Port Moresby','Lae',
  // USA Atlantic
  'New York','Newark','Baltimore','Philadelphia','Boston','Charleston',
  'Savannah','Jacksonville','Miami','Tampa','Port Everglades','Wilmington (NC)',
  'Virginia (Hampton Roads)','Norfolk','Providence','Portland (ME)',
  'Brunswick (GA)',
  // USA Gulf
  'Houston','New Orleans','Gulfport','Mobile','Corpus Christi','Beaumont',
  'Port Arthur','Lake Charles','Pascagoula',
  // USA Pacific
  'Los Angeles','Long Beach','Oakland','Seattle','Tacoma','Portland (OR)',
  'San Francisco','Honolulu','Anchorage',
  // Canada
  'Vancouver','Prince Rupert','Montreal','Halifax','Saint John (NB)',
  "Saint John's (NL)",'Thunder Bay','Quebec City',
  // Mexico
  'Veracruz','Altamira','Tampico','Manzanillo (MX)','Lázaro Cárdenas',
  'Ensenada','Guaymas','Salina Cruz',
  // Caribbean & Central America
  'Kingston','Bridgetown','Port of Spain','Nassau','San Juan','Freeport (Bahamas)',
  'Willemstad',
  'Colon','Balboa','Cristobal',
  'Puerto Quetzal','Acajutla','Corinto','Puerto Limón',
  // South America
  'Cartagena (CO)','Barranquilla','Buenaventura','Santa Marta',
  'La Guaira','Maracaibo','Puerto Cabello',
  'Guayaquil','Esmeraldas',
  'Callao','Ilo','Paita',
  'Valparaíso','San Antonio (CL)','Iquique','Antofagasta','Arica',
  'Punta Arenas','Puerto Montt',
  'Santos','Paranaguá','Itajaí','Rio de Janeiro','Itaguaí','Suape',
  'Fortaleza','Belém','Manaus','Salvador','Vitória','Recife',
  'São Luís','Vila do Conde',
  'Buenos Aires','Rosario','Bahía Blanca',
  'Montevideo',
  // Gibraltar (bunkering hub)
  'Gibraltar',
];

// Deduplicate and sort
const _seen = new Set<string>();
export const WORLD_PORTS: string[] = [];
for (const p of RAW) {
  if (!_seen.has(p)) { _seen.add(p); WORLD_PORTS.push(p); }
}
WORLD_PORTS.sort((a, b) => a.localeCompare(b));

export function searchPorts(q: string): string[] {
  if (!q.trim()) return [];
  const low = q.toLowerCase();
  const starts = WORLD_PORTS.filter((p) => p.toLowerCase().startsWith(low));
  const contains = WORLD_PORTS.filter(
    (p) => !p.toLowerCase().startsWith(low) && p.toLowerCase().includes(low),
  );
  return [...starts, ...contains].slice(0, 8);
}
