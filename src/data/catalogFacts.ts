/**
 * Short factual blurbs shown under each catalog item in the library.
 *
 * Real-world entries lead with country / service years / units built / unit
 * cost, then one or two stats that make the size on screen mean something.
 * Costs are flyaway or program-unit figures; the year in parentheses is the
 * dollar basis, with a rough present-day equivalent where it is well known.
 * Fictional entries use in-universe or production figures.
 */
export const CATALOG_FACTS: Record<string, string> = {
  // --- Reference -------------------------------------------------------------
  'person-male':
    'Global average adult male height is about 1.71 m; the US average is roughly 1.75 m. The baseline human for every other comparison here.',
  'person-female':
    'Global average adult female height is about 1.59 m; the US average is roughly 1.62 m.',
  'minecraft-player':
    'Steve stands 1.8 blocks tall in game — about 1.8 m if a block is 1 m. Minecraft is the best-selling video game ever, with over 300 million copies sold since 2011.',
  'soldier-ww2':
    'US Army Ranger, 1944. About 16 million Americans served in WWII. A rifleman carried roughly 25–35 kg of kit, and the M1 Garand he shouldered weighed 4.3 kg.',
  'iphone':
    'Apple has sold well over 2 billion iPhones since 2007, making it one of the best-selling products of any kind. A modern handset is about 147 mm tall and 170–230 g.',
  'banana':
    'The banana for scale. A supermarket Cavendish runs about 180 mm long and 120 g, and roughly 100 billion bananas are eaten worldwide each year — the world’s most popular fruit, and a single cloned cultivar.',
  'firetruck':
    'A full aerial-ladder truck runs roughly $1–1.5 million, weighs 25–30 t loaded, and carries a ladder reaching 30 m or more.',
  'school-bus':
    'About 480,000 school buses operate in the US, carrying more children each day than every other form of public transport combined. A new Type C bus costs roughly $120,000 and seats up to 90 kids.',
  'container-20':
    'The ISO 40-foot container holds about 67 m³, weighs 3.8 t empty, and is rated to 30.5 t gross. Roughly 25 million are in circulation, and standardising them in the 1950s cut ocean freight costs by over 90%.',

  // --- Armour and ground -----------------------------------------------------
  'sherman':
    'USA, 1942–1957. 49,234 built — the most-produced US tank ever. 30 t, 75 mm gun, about $45,000 in 1944 (roughly $800,000 today). Mass production, not protection, was the point: Shermans were outgunned by Panthers and Tigers but arrived in overwhelming numbers.',
  'abrams':
    'USA, 1980–present. Around 10,000 M1-series built. 73 t, 120 mm smoothbore, and a 1,500 hp gas turbine good for 67 km/h. An M1A2 SEPv3 runs about $10 million and burns roughly 1.5 litres of fuel per kilometre.',
  'chieftain':
    'United Kingdom, 1966–1996. About 2,265 built, including 707 for Iran. 55 t with a 120 mm rifled gun — the heaviest-armed and best-armoured tank in the world when it entered service, but chronically underpowered.',
  't72':
    'Soviet Union / Russia, 1973–present. Around 25,000 built and exported to 40-plus countries, making it one of the most widely used tanks ever. 45 t, 125 mm smoothbore with a carousel autoloader that lets it run with a crew of three.',
  'patriot':
    'USA, 1981–present. A full battery costs roughly $1.1 billion, and a single PAC-3 MSE interceptor about $4 million. Engagement range reaches 160 km against aircraft; a launcher carries four PAC-2 or sixteen PAC-3 rounds.',
  'c-ram':
    'USA, 2005–present. A land-based Phalanx: a 20 mm Gatling firing 4,500 rounds per minute at incoming rockets and mortar shells. It uses self-destructing rounds so misses do not land on friendly ground. About $15 million per system.',

  // --- Fighters --------------------------------------------------------------
  'f16':
    'USA, 1978–present. Over 4,600 built and flown by 25 air forces — the most-produced Western fighter since the 1970s. Mach 2, 550 km combat radius, radar cross-section around 1.2 m² — about the radar return of an adult standing side-on. New Block 70 aircraft cost roughly $63 million.',
  'f22':
    'USA, 2005–2012. Only 195 built before the line closed. About $150 million flyaway, or $350 million per aircraft counting development. Its radar cross-section is often quoted at 0.0001 m² — about the radar return of a honeybee — and it supercruises at Mach 1.8 without afterburner.',
  'f35':
    'USA, 2015–present. Over 1,100 delivered of roughly 3,000 planned, across three variants. An F-35A costs about $82 million. Radar cross-section is roughly 0.0015 m² — a golf ball, and some fifteen times the F-22’s honeybee. Combat radius is 1,240 km, and it fuses sensor data across an entire formation.',
  'f18':
    'USA, 1999–present. About 600 Super Hornets built at roughly $70 million each. 20% larger than the original Hornet, carrier-capable, and the backbone of US Navy strike wings. Its radar cross-section is unpublished, but reshaped intakes and edge treatments are generally credited with roughly a tenth of the legacy Hornet’s return — on the order of 0.1 m², about a pigeon.',
  'spitfire':
    'United Kingdom, 1938–1948. 20,351 built across 24 marks — the only British fighter in continuous production through the whole war. About £12,600 in 1940 (roughly £700,000 today). Its elliptical wing was expensive to build but gave low drag and a 594 km/h top speed on the Mk IIa. Radar cross-section was nobody’s concern in 1938: an unshaped fighter this size returns several square metres, a larger radar target than the man flying it.',
  'mig23':
    'Soviet Union, 1970–1985. Around 5,000 built, making it one of the most-produced supersonic fighters ever. Variable-sweep wings let it operate from short strips and reach Mach 2.35. The MLD was the final, most agile Soviet variant, with reworked aerodynamics and radar. Its slab sides and boxy intakes concede nothing to stealth — estimates run to several square metres, about a doorway’s worth of radar return.',
  'mig35':
    'Russia, 2019–present. Only a handful delivered against hopes of hundreds — export orders never materialised. A deep 4++ generation rework of the MiG-29 with AESA radar, thrust vectoring and roughly 50% more range, at about $40 million. Radar-absorbent coatings are claimed to cut its return to around 1 m² — an adult human — from the MiG-29’s five or so.',
  'su57':
    'Russia, 2020–present. Roughly 20–30 delivered so far of 76 ordered, at an estimated $35–50 million each. Russia’s first stealth fighter, with supercruise and thrust vectoring, though its radar cross-section is widely judged well short of the F-22’s owing to exposed engine faces and surface gaps. Western estimates cluster around 0.1–1 m² — a pigeon to a person — against the F-22’s honeybee.',
  'sr71':
    'USA, 1966–1998. Only 32 built, at about $34 million each in 1960s dollars. Mach 3.3 at 26,000 m, and no SR-71 was ever lost to enemy fire — over 4,000 missiles were fired at them and all missed. The titanium airframe leaked fuel on the ground because the panels only sealed once friction heated the skin past 300 °C. Sloped chines and iron-ball paint cut its radar return hard for 1960s work, but frontal RCS is still put near 10 m² — elephant-sized. Nothing could catch it anyway.',
  'f117':
    'USA, 1983–2008. 59 built at about $42.6 million each in 1983 dollars (roughly $135 million today). Its faceted shape was dictated by 1970s computers that could only model flat panels, cutting radar cross-section to around 0.003 m² — roughly the radar return of a tennis ball. One was lost to a Serbian SAM in 1999 — the only combat loss.',

  // --- Bombers ---------------------------------------------------------------
  'b29':
    'USA, 1943–1946. 3,970 built. Its $3 billion development cost more than the Manhattan Project whose bombs it carried — about $600,000 per aircraft in 1945, roughly $10 million today. The first bomber with a pressurised cabin and remote-controlled gun turrets, with a 5,230 km range. Radar cross-section was not yet a design variable: 43 m of bare aluminium wing returns on the order of 100 m², about the broad side of a house.',
  'b52':
    'USA, 1955–1962. 744 built, and 76 are still flying — the airframes are older than the crews’ grandparents, with service now projected past 2050, a century after first flight. 32,000 kg payload, 14,080 km unrefuelled range, and eight engines being replaced with modern turbofans. Its radar cross-section is around 100 m² — a house — which is why it now flies as a standoff missile truck instead of penetrating defended airspace.',
  'b21':
    'USA, first flight November 2023. At least 100 planned at about $692 million each in 2022 dollars. Designed around open-architecture upgrades, and smaller than the B-2 it replaces. Exact dimensions and radar cross-section remain classified; it is intended to better the B-2’s, itself quoted near 0.1 m².',
  'b2':
    'USA, 1997–present. Only 21 built after the Cold War ended, at roughly $2.1 billion each including development — the most expensive aircraft ever. 11,000 km unrefuelled range, and a flying-wing shape with no vertical surfaces to reflect radar. Its cross-section is commonly quoted near 0.1 m² — a pigeon’s worth of return from an aircraft with a 52 m wingspan.',
  'b1':
    'USA, 1986–present. 100 built at about $283 million each. Mach 1.25 with variable-sweep wings, and the largest internal payload of any US bomber at 34,000 kg. Radar cross-section is about 1 m² — an adult human, and a hundredth of the B-52’s — achieved with blended surfaces and serpentine intake ducts rather than faceting. Now conventional-only; its nuclear role was retired under START.',
  'tu22m3':
    'Soviet Union / Russia, 1972–1993. About 497 built. Mach 1.88, 6,800 km range, and up to 24,000 kg of ordnance — originally designed to hunt NATO carrier groups with long-range anti-ship missiles. There is no low-observable shaping anywhere on it — the return is tens of square metres, elephant-sized or worse — so it shoots from standoff range.',
  'h20':
    'China, in development and not yet publicly flown. Expected to be a subsonic flying wing with 8,500 km-plus range and a 10 t payload. A flying wing implies a low radar cross-section, but no figure has been published — nearly all specifics remain unconfirmed, and the shape shown here is an estimate.',

  // --- Airliners and transports ---------------------------------------------
  'concorde':
    'UK/France, 1976–2003. Only 20 built, 14 of them for service, at a development cost of £1.3 billion — roughly £11 billion today, never recouped. Mach 2.04 crossed the Atlantic in under 3 hours, the fuselage stretched about 25 cm from friction heating in cruise, and it was retired after the 2000 Paris crash and the post-9/11 traffic collapse.',
  'a320':
    'Airbus, 1988–present. Over 12,000 A320s delivered and 18,000-plus across the family, rivalling the 737 as the best-selling airliner ever. 150–180 seats, 6,100 km range, roughly $110 million at list. The first airliner with digital fly-by-wire controls.',
  'a380':
    'Airbus, 2007–2021. Only 251 built at about $445 million each, ending a decade early. The largest passenger airliner ever flown: two full decks, 79.8 m of wingspan, 575 seats in a typical layout and up to 853 in all-economy.',
  'boeing-737':
    'Boeing, 1998–2020 for the -800. About 5,000 built at roughly $106 million list. 189 seats maximum and 5,400 km range. The 737 family has passed 12,000 deliveries since 1967.',
  'boeing-747':
    'Two VC-25A aircraft have served as Air Force One since 1990. 4,000 ft² of interior space over three decks, aerial refuelling, and an onboard medical suite. The VC-25B replacements are running roughly $5.3 billion for the pair.',
  'c17a':
    'USA, 1993–2015. 279 built at about $218 million each. Carries 77,500 kg — an M1 Abrams fits — yet lands on a 3,500 ft dirt strip and can reverse under its own power on the ground.',
  'c5':
    'USA, 1970–present. 131 built; 52 rebuilt as C-5Ms from 2009. Carries 129,300 kg — two M1 Abrams — through nose and tail doors that both open, and it kneels on its landing gear so vehicles can drive straight in.',
  'c18a':
    'A concept heavy-lift transport shown at roughly C-17 scale, about 53 m long. Not a real production aircraft.',
  'v22':
    'USA, 2007–present. About 400 built at roughly $75 million each. Tilts its rotors to take off like a helicopter and cruise at 509 km/h like a turboprop — twice a helicopter’s speed — carrying 24 troops.',
  'apache':
    'USA, 1986–present. Over 2,700 built. An AH-64E costs about $52 million and carries a 30 mm chain gun plus up to 16 Hellfire missiles. Its mast-mounted radar tracks 128 targets and lets it pop up to fire from behind cover.',
  'chinook':
    'USA, 1962–present and still in production after six decades. Over 1,200 built at roughly $38 million each. Lifts 10,900 kg slung beneath it and cruises at 315 km/h — the fastest helicopter in the US Army.',
  'blackhawk':
    'USA, 1979–present. Over 5,000 built, about $21 million for a UH-60M. Carries 11 troops or 3,600 kg slung, and was designed after Vietnam to survive a hard crash landing that would destroy earlier helicopters.',
  'mi26':
    'USSR/Russia, 1983–present. Over 300 built. The heaviest and most powerful helicopter ever to reach production: 20,000 kg of cargo — as much as its own empty weight — inside a hold sized like a C-130’s, under an eight-blade 32 m rotor.',
  'mi10':
    'USSR, 1963–1970s. Around 55 built. A flying crane derived from the Mi-6: 15,000 kg slung under 3.8 m stilt landing gear tall enough to straddle a loaded cargo platform and drive away with it.',
  'pave-low':
    'USA, 1981–2008. 38 converted, about $40 million each. The US Air Force’s biggest and heaviest helicopter, flying special-operations crews at 30 m above the ground at night on terrain-following radar and infrared.',
  's97':
    'USA, 2015–present. 2 built as demonstrators. Coaxial rigid rotors plus a pusher propeller let it reach 380 km/h — roughly double a conventional helicopter’s cruise — as Sikorsky’s technology testbed for the US Army.',

  // --- Munitions -------------------------------------------------------------
  'tnt':
    'A Minecraft-style block, one metre a side. Real TNT releases 4.18 megajoules per kilogram — the unit every nuclear yield on this site is measured in.',
  'jdam':
    'A GBU-31 is a 907 kg Mk 84 bomb with a roughly $25,000 GPS tail kit bolted on. Over 500,000 kits have been built since 1997, turning dumb bombs into weapons with about 5 m accuracy and a 28 km glide range.',
  'little-boy':
    'Detonated over Hiroshima on 6 August 1945. 15 kilotons from a gun-type design firing one piece of uranium-235 into another; only about 1.4% of its 64 kg of uranium actually fissioned. 4,400 kg. Around 140,000 people died by the end of that year.',
  'fat-man':
    'Detonated over Nagasaki on 9 August 1945. 21 kilotons from a plutonium core crushed by 32 shaped charges firing within microseconds. 4,670 kg of bomb around just 6.2 kg of plutonium. Around 74,000 people died by the end of 1945.',
  'tsar-bomba':
    'Soviet Union, tested over Novaya Zemlya on 30 October 1961. 50 megatons — over 3,000 Hiroshimas, and still the largest explosion ever produced by humans. The fireball was 8 km across, the cloud rose 67 km, and the shockwave circled the Earth three times. It was deliberately halved in yield; the full design was 100 Mt.',

  // --- Spaceflight -----------------------------------------------------------
  'spaceship':
    'A stylised cargo craft at 18 m long, roughly the size of a real resupply vehicle such as Cygnus or ATV.',
  'electron':
    'Rocket Lab, 2017–present. 300 kg to low Earth orbit for about $7.5 million. Carbon-composite tanks and 3D-printed, battery-fed Rutherford engines; boosters have been recovered by parachute after ocean splashdown.',
  'falcon-9':
    'SpaceX, 2010–present. 22.8 t to low Earth orbit for a list price of about $70 million. Individual boosters have flown more than 20 times each, and the fleet has passed 400 launches — in recent years more than the rest of the world combined.',
  'soyuz-tma':
    'Russia, 2002–2012. 33 flown, each carrying three crew. Between the Shuttle’s retirement in 2011 and 2020 it was the only ride to the ISS, and NASA paid up to about $90 million per seat.',
  'shuttle-discovery':
    'OV-103 flew 39 missions between 1984 and 2011, more than any other spacecraft. It deployed the Hubble Space Telescope and returned Americans to flight after both the Challenger and Columbia losses. Now on display at the Udvar-Hazy Center.',
  'shuttle-atlantis':
    'The full launch stack — orbiter, external tank and two solid boosters — weighs 2,030 t on the pad. The Shuttle programme flew 135 missions from 1981 to 2011, lost two crews, and cost roughly $196 billion, about $1.5 billion per flight.',
  'new-glenn':
    'Blue Origin, first flight January 2025. 45 t to low Earth orbit with a reusable first stage and a 7 m fairing — twice the volume of a Falcon 9’s, sized for bulky payloads rather than merely heavy ones.',
  'sls':
    'NASA, first flight Artemis I in November 2022. 95 t to low Earth orbit and 8.8 MN of liftoff thrust. It reuses Shuttle-derived RS-25 engines and boosters, and costs an estimated $2.2–4.1 billion per launch.',
  'saturn-v':
    'USA, 1967–1973. 13 launched, none lost. 140 t to low Earth orbit, 2,970 t on the pad, and 35 MN of thrust from five F-1 engines. About $185 million per launch in 1969 dollars — roughly $1.6 billion today. Still the only rocket to have carried humans beyond low Earth orbit.',
  'n1':
    'Soviet Union, 1969–1972. All four launches failed and the programme was cancelled in secret. Its first stage packed 30 NK-15 engines for 45 MN of thrust — more than a Saturn V — but there was no way to test the cluster on the ground before flight.',
  'starship':
    'SpaceX, in flight test. Designed to be fully reusable and to lift 100 t or more to orbit. 33 Raptor engines produce roughly 74 MN at liftoff, making it the most powerful rocket ever flown.',

  // --- Landmarks -------------------------------------------------------------
  'statue-liberty':
    'Dedicated 1886, a gift from France designed by Frédéric Bartholdi with an internal frame by Gustave Eiffel. The copper skin is just 2.4 mm thick and weighs 31 t; a century of weathering turned it green. About 4 million people visit each year.',
  'eiffel':
    'Built for the 1889 World’s Fair and meant to stand only 20 years. 7,300 t of wrought iron in 18,038 parts held by 2.5 million rivets. World’s tallest structure until 1930, it grows about 15 cm on hot days and draws 7 million visitors a year.',
  'big-ben':
    'The Elizabeth Tower was completed in 1859; Big Ben is properly the 13.7 t hour bell inside, which cracked shortly after installation and has rung with an odd tone ever since. 334 steps, no lift, and an £80 million restoration from 2017 to 2022.',
  'colosseum':
    'Completed in AD 80 and still the largest amphitheatre ever built. It held 50,000–80,000 spectators, who could clear the building in minutes through 80 numbered arched entrances. Roughly 7 million people visit each year.',
  'washington-monument':
    'Completed in 1884 after a 25-year pause for the Civil War — the colour change a third of the way up marks where work restarted with marble from a different quarry. 36,491 blocks, and still the tallest stone structure in the world.',
  'burj':
    'Dubai, opened 2010. 828 m and 163 floors, built for about $1.5 billion. It has held the world’s-tallest title since 2009 by a margin of over 300 m, uses a buttressed-core design to resist wind, and sways about 1.5 m at the tip.',
  'christ-redeemer':
    'Rio de Janeiro, completed 1931. 30 m of reinforced concrete faced in soapstone, on an 8 m pedestal, with a 28 m arm span. It weighs about 635 t and sits 700 m up Corcovado, where it is struck by lightning several times a year.',
  'stonehenge':
    'Built in stages between roughly 3000 and 2000 BC. The sarsens weigh up to 25 t and came from about 25 km away; the smaller bluestones were hauled some 250 km from the Preseli hills in Wales. The stones align with midsummer sunrise and midwinter sunset.',
  'sydney-opera-house':
    'Opened 1973 to a design by Jørn Utzon, who resigned mid-project and never saw it finished. Budgeted at A$7 million, it cost A$102 million — fourteen times over — and its shells carry 1,056,006 self-cleaning tiles.',
  'great-pyramids':
    'Built for Khufu around 2560 BC from roughly 2.3 million blocks averaging 2.5 t. Originally 146.6 m tall; the lost casing stones account for the missing 8 m today. It was the tallest structure on Earth for about 3,800 years — the longest any record has ever stood.',

  // --- Ships -----------------------------------------------------------------
  'ford-carrier':
    'USA, lead ship commissioned 2017. About $13.3 billion each — the most expensive warship ever built. 100,000 t, 75-plus aircraft, 4,500 crew, and two A1B reactors that never need refuelling across a 50-year hull. Electromagnetic catapults replaced steam.',
  'nimitz':
    'USA, 1975–2009. 10 built, roughly $8.5 billion each in today’s money. 100,000 t, about 90 aircraft, 5,000 crew, and 25 years of steaming between reactor refuellings. Each ship is effectively a small city, with its own hospital, TV station and post office.',
  'container-ship':
    'An E-class ship carries about 15,000 twenty-foot containers on a 398 m hull, driven by an 80 MW diesel — roughly 109,000 hp from a single engine. Around $145 million each. Ships like this move the bulk of world trade by volume.',
  'super-tanker':
    'A Suezmax crude carrier holds roughly 160,000 deadweight tonnes — about one million barrels of oil — and is sized to the maximum draught the Suez Canal allows. Loaded, it needs several kilometres to stop.',
  'virginia':
    'USA, 2004–present. Over 20 built at roughly $3.5 billion each. 7,900 t submerged, over 25 knots, and a reactor core that lasts the 33-year life of the boat. Photonics masts replaced the traditional through-hull periscope.',
  'ohio':
    'USA, 1981–1997. 18 built. Fourteen carry 20 Trident II missiles each and hold most of the US nuclear deterrent at sea; four were converted to carry 154 Tomahawks instead. 18,750 t submerged, with patrols running about 77 days.',
  'independence':
    'USA, 2010–present. 19 built at roughly $360 million each. An aluminium trimaran that hits 44 knots and was meant to swap mission modules for mine warfare, submarine hunting or surface combat — though the modular concept was largely abandoned.',
  'type45':
    'United Kingdom, 2009–2013. Six built at about £1 billion each. 8,500 t, and its Sea Viper system with the Sampson radar can track over 1,000 targets at once. Early ships suffered notorious power failures in warm water.',
  'arleigh-burke':
    'USA, 1991–present. Over 75 built and still in production — the largest class of surface combatants built since WWII. About $2.2 billion each, 9,700 t, with the Aegis combat system and 96 vertical launch cells.',
  'zumwalt':
    'USA, three built before the class was cut from 32. Roughly $8 billion each including development. The tumblehome hull gives it the radar signature of a small fishing boat despite 16,000 t of displacement; its guns were cancelled when shells reached about $800,000 apiece.',
  'moskva':
    'Soviet Union, two built 1967–1969. Helicopter carriers designed to hunt NATO ballistic-missile submarines in the Mediterranean with 14 Ka-25 helicopters. Poor seakeeping cut the class short.',
  'wasp':
    'USA, 1989–2009. Eight built at roughly $750 million each. 40,500 t — larger than most nations’ aircraft carriers — carrying about 31 aircraft plus 1,894 Marines, with a flooded well deck for landing craft.',
  'iowa':
    'USA, four built 1943–1944. About $100 million each at the time, roughly $1.8 billion today. 57,500 t, nine 16-inch guns firing 1,225 kg shells 38 km, and 33 knots — the fastest battleships ever built. All four served again in the 1980s with Tomahawks bolted on.',
  'kiev':
    'Soviet Union, four built 1975–1987. 45,000 t hybrids carrying Yak-38 VTOL jets and helicopters aft, with heavy anti-ship missiles forward. Two were later sold on to China and India.',

  // --- Animals ---------------------------------------------------------------
  'rabbit':
    'The European rabbit is native to Iberia and southern France, yet is now one of the world’s worst invasive species — 24 released in Australia in 1859 became hundreds of millions within 50 years. Ironically it is Endangered in its home range.',
  'owl':
    'The great horned owl ranges from Alaska to Tierra del Fuego. Its grip closes hard enough to take prey heavier than itself, asymmetric ear openings let it pinpoint a mouse under snow by sound alone, and fringed feathers make its flight nearly silent.',
  'wolf':
    'Gray wolves number roughly 200,000–250,000 worldwide and once ranged across the entire northern hemisphere. A pack can cover 50 km in a day, and a howl carries up to 10 km. Their 1995 reintroduction to Yellowstone reshaped the park by moving elk off the riverbanks.',
  'leopard':
    'The most widely distributed big cat, found from Africa to the Russian Far East, but it has lost roughly 75% of its historic range. It can haul prey heavier than itself up a tree, and the Amur subspecies is down to about 130 individuals in the wild.',
  'eagle':
    'The bald eagle recovered from about 417 nesting pairs in the lower 48 states in 1963 to over 70,000 pairs today, after DDT was banned. Its nests are the largest built by any bird — one weighed nearly 3 t — and its eyesight is several times sharper than a human’s.',
  'horse':
    'Draft breeds such as the Shire and Belgian stand 1.7–1.8 m at the withers and weigh 700–1,000 kg, and a pair can pull loads of several tonnes. The tallest horse on record, Sampson, reached 2.19 m in the 1850s.',
  'rhino':
    'About 17,000 southern white rhinos remain — a conservation success from fewer than 100 in the 1890s. The northern subspecies is functionally extinct, with two females left. A bull weighs up to 2,300 kg, and its horn is keratin, the same material as fingernails.',
  'anaconda':
    'The green anaconda of the Amazon basin is the heaviest snake in the world, reaching 5–6 m and over 100 kg. It gives birth to live young, ambushes prey from shallow water, and can go weeks or months between meals.',
  'elephant':
    'The African bush elephant is the largest land animal, at up to 6,000 kg. Around 415,000 African elephants remain, down from several million a century ago. A trunk contains roughly 40,000 muscle units, and herds communicate over kilometres using infrasound below human hearing.',
  'ankylosaurus':
    'Late Cretaceous North America, about 68–66 million years ago. Roughly 6 t of armoured plate with a bony tail club that could swing hard enough to break bone. Known from only a handful of partial specimens — no complete skeleton has ever been found.',
  'carnotaurus':
    'Late Cretaceous Argentina, about 72–70 million years ago. Known from a single remarkably complete skeleton that preserved skin impressions. It had horns above its eyes, absurdly small arms even by tyrannosaur standards, and may have been among the fastest large predators.',
  'giganotosaurus':
    'Late Cretaceous Argentina, about 98 million years ago — some 30 million years before T. rex. At roughly 12–13 m and 8 t it slightly exceeded T. rex in length, though with a lighter build and a weaker bite.',
  'spinosaurus':
    'Cretaceous North Africa, about 99–93 million years ago, and the longest known predatory dinosaur at 14–15 m. Its paddle-like tail and dense bones point to a semi-aquatic life hunting fish. The only good skeleton was destroyed in a 1944 air raid on Munich.',

  // --- Stargate --------------------------------------------------------------
  'zpm':
    'Zero Point Module — an Ancient power source drawing vacuum energy from an artificial subspace region. About 36 cm tall, and capable of powering an entire city-ship; three fully charged ones were needed to run Atlantis at full capacity.',
  'tealc':
    'Jaffa warrior of the Free Jaffa Nation and first officer of SG-1. Scaled from Christopher Judge’s height of about 1.96 m.',
  'milky-way-stargate':
    'A 6.7 m ring of naquadah with 39 symbols on its inner track. Dialling seven opens a stable wormhole to another gate, which holds for 38 minutes unless externally powered. The production prop was built at full scale and weighed well over a tonne.',
  'puddle-jumper':
    'Ancient gateship, roughly 10.5 m long and built to fit through a Stargate with retractable engine pods. Carries a cloaking device and a drone weapon bay, and is the standard Atlantis expedition runabout.',
  'alkesh':
    'Goa’uld mid-range bomber, about 45 m. Carries a cloak, ring transporter and heavy plasma bombardment cannons — used against ground targets rather than in ship-to-ship fights.',
  'prometheus':
    'X-303 Prometheus, Earth’s first deep-space battlecruiser, built in secret in Nevada from reverse-engineered alien technology. Roughly 520 m at VFX scale. Destroyed over Tegalus in 2007.',
  'daedalus':
    'BC-304 Daedalus, roughly 730 m. Its Asgard hyperdrive crosses to the Pegasus galaxy in 18 days, Asgard beaming moves personnel and warheads instantly, and 16 F-302 fighters ride in the bays.',
  'hatak':
    'Goa’uld mothership, roughly 700 m across the pyramid hull. Shielded, crewed by Jaffa, and carrying hundreds of death gliders — the standard capital ship of the System Lords.',
  'ori-warship':
    'Ori mothership, roughly 2.6 km long. Its shields and main beam weapon outclassed anything in the Milky Way until the Asgard plasma beam was fitted to the BC-304 fleet.',
  'wraith-cruiser':
    'Wraith escort cruiser, roughly 900 m. Grown rather than built, from organic materials that regenerate battle damage. On-screen scale estimates range from 600 m to 1.2 km.',
  'atlantis':
    'Ancient city-ship, roughly 3 km across, built in the Milky Way and flown to Pegasus. It sat on the ocean floor for 10,000 years under a shield, runs on three ZPMs, and can submerge or fly as a single vessel.',

  // --- Star Wars -------------------------------------------------------------
  'grogu':
    'About 42 cm tall and 50 years old during The Mandalorian — Yoda’s species ages extraordinarily slowly. The animatronic puppet reportedly cost around $5 million to build.',
  'yoda':
    'Jedi Grand Master, 66 cm tall and 900 years old at his death. His species is never named in canon; only a handful of members have ever appeared on screen.',
  'stormtrooper':
    'Imperial armour is 18 pieces of plastoid composite over a black body glove. The original costumes were vacuum-formed for A New Hope, and actors could barely see or hear inside them.',
  'k2so':
    'Reprogrammed Imperial KX-series security droid, 2.16 m. Played by Alan Tudyk on stilts and finished in CGI — among the tallest droids to serve as a main character.',
  'at-te':
    'All Terrain Tactical Enforcer, about 22 m long. A six-legged Republic walker carrying around 20 troopers and a mass-driver cannon, able to climb near-vertical surfaces.',
  'millennium-falcon':
    'Corellian YT-1300f light freighter, 34.75 m. Heavily modified by Han Solo, and famously claimed to have made the Kessel Run in less than 12 parsecs — a boast about a shorter route, not a faster time.',
  'cr-90':
    'Corellian corvette, 150 m, known as the Blockade Runner. The Tantive IV carried Leia and the Death Star plans in the opening shot of A New Hope.',
  'venator':
    'Republic attack cruiser, 1,137 m. Carries roughly 400 starfighters launched through dorsal doors that split the hull open, and was the Clone Wars workhorse before the Imperial-class replaced it.',
  'isd-ii':
    'Imperial II-class Star Destroyer, 1,600 m. Crew of over 37,000 plus 72 TIE fighters, and enough firepower to subdue a planet — the point being that one arriving in orbit was meant to end a rebellion by reputation alone.',
  'death-star-ii':
    'The second Death Star, roughly 160 km across and still under construction over Endor. Its superlaser could fire far more frequently than the first station’s, and the incomplete hull was itself the bait for a trap.',

  // --- Star Trek -------------------------------------------------------------
  'type-15-shuttle':
    'Type 15 shuttlepod, 3.6 m. A two-person short-range craft with impulse engines only, carried aboard Galaxy-class ships. Figures from the TNG Technical Manual.',
  'intrepid-type':
    'United Earth Intrepid type, roughly 165 m. A 22nd-century Starfleet ship contemporary with Enterprise NX-01, seen only briefly on screen.',
  'klingon-d5':
    'Klingon D5-class cruiser, roughly 250 m. A 22nd-century battle cruiser predating the more familiar D7, seen in Enterprise.',
  'constitution-tos':
    'Constitution-class, 289 m, crew of 430. Only twelve were in service in the 2260s, which is why losing one was a fleet-scale event. The original USS Enterprise, NCC-1701.',
  'walker-shenzhou':
    'Walker-class USS Shenzhou, about 423 m. Commanded by Philippa Georgiou until the Battle of the Binary Stars in 2256. Scale from the Official Starships Collection.',
  'dsc-enterprise':
    'The Discovery-era Constitution-class USS Enterprise, about 442 m — noticeably larger than the TOS design it reinterprets. Commanded by Christopher Pike.',
  'akira':
    'Akira-class heavy cruiser, 464 m. A carrier-style design with a catamaran hull and 15 torpedo launchers, first seen in First Contact.',
  'constitution-iii':
    'Constitution III-class, 560 m. The USS Enterprise-F design from Picard — a deliberate callback to the original silhouette at nearly twice the size.',
  'dkyr':
    'Vulcan D’Kyr-type combat cruiser, roughly 600 m. Its ring-shaped warp nacelle is a Vulcan design signature going back centuries.',
  'valdore':
    'Romulan Valdore-type warbird, 604 m. Introduced in Nemesis, with wings that pivot in flight and a shipboard cloaking device.',
  'enterprise-d':
    'Galaxy-class USS Enterprise-D, 642.5 m. Crew of about 1,014 including families — the first Starfleet flagship designed for civilians aboard. The saucer separates for combat.',
  'sovereign':
    'Sovereign-class, 685 m. Built after the Borg attack at Wolf 359 with a leaner, more heavily armed profile than the Galaxy-class. The USS Enterprise-E.',
  'sto-sovereign':
    'The same 685 m Sovereign-class hull, rendered from the Star Trek Online mesh.',
  'uss-discovery':
    'Crossfield-class USS Discovery, 750 m. Its spore drive jumps instantaneously anywhere via the mycelial network — a technology written out of the timeline to explain why nothing later uses it.',
  'borg-cube':
    'Borg tactical cube, roughly 3 km on each edge. Crewed by thousands of drones with no bridge, no single point of failure, and full regenerative repair. One cube nearly ended the Federation at Wolf 359.',
  'earth-spacedock':
    'Earth Spacedock, about 3.8 km tall in orbit above San Francisco. Its interior bay holds starships the size of the Enterprise with room to spare, entered through vast doors at the base.',

  // --- Money -----------------------------------------------------------------
  'money-1m':
    'A million dollars in $100 bills weighs about 10 kg and fits in a carry-on bag.',
  'money-100m':
    'About 1 t of $100 bills — roughly the price of a single F-35A with change left over.',
  'money-1b':
    'About 10 t of $100 bills — roughly the cost of one Royal Navy Type 45 destroyer.',
  'money-100b':
    'About 1,000 t of $100 bills — comparable to the annual revenue of a large multinational, or a little over a tenth of the US defence budget.',
  'money-1t':
    'About 10,000 t of $100 bills — heavier than the Eiffel Tower, and enough to buy the entire Apollo programme several times over in today’s money.',
  'money-us-debt':
    'US federal debt, around $39.9 trillion as of August 2026. In $100 bills it would weigh roughly 400,000 t — about four Ford-class carriers’ worth of paper.',
}
