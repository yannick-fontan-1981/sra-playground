import type {LevelSpec} from './core.js';
export const SS19_LEVELS:readonly LevelSpec[]=[
  {
    "id": "ss19-01",
    "title": "Le gardien du seuil",
    "rows": [
      "####################",
      "####################",
      "####################",
      "###########...m#####",
      "####################",
      "####################",
      "######W.......######",
      "########.#####.o####",
      "########.......#.###",
      "##..####.....B...###",
      "##.Z~~~~.........g##",
      "##..####.........###",
      "########.........###",
      "########.........###",
      "########.........###",
      "#########g#####g####",
      "####################",
      "####################",
      "####################",
      "####################"
    ],
    "facing": "E",
    "circuits": [
      {
        "id": "seuil",
        "buttons": [
          {
            "x": 11,
            "y": 3
          },
          {
            "x": 3,
            "y": 10
          }
        ],
        "color": 15
      },
      {
        "id": "poussee-1",
        "buttons": [
          {
            "x": 10,
            "y": 6
          }
        ],
        "color": 11
      },
      {
        "id": "poussee-2",
        "buttons": [
          {
            "x": 11,
            "y": 6
          }
        ],
        "color": 14
      },
      {
        "id": "poussee-3",
        "buttons": [
          {
            "x": 12,
            "y": 6
          }
        ],
        "color": 12
      }
    ],
    "gates": [
      {
        "at": {
          "x": 14,
          "y": 3
        },
        "circuit": "poussee-1",
        "direction": "W",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 13,
          "y": 3
        },
        "circuit": "poussee-2",
        "direction": "W",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 12,
          "y": 3
        },
        "circuit": "poussee-3",
        "direction": "W",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 9,
          "y": 15
        },
        "circuit": "seuil",
        "direction": "N",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 15,
          "y": 15
        },
        "circuit": "seuil",
        "direction": "N",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 17,
          "y": 10
        },
        "circuit": "seuil",
        "direction": "W",
        "closedWhen": "released"
      }
    ]
  },
  {
    "id": "ss19-02",
    "title": "Les galeries des gardiens",
    "rows": [
      "####################",
      "####.#########o#####",
      "##..o.............##",
      "##..o.............##",
      "#g..W.Z...........g#",
      "##................##",
      "##................##",
      "##..################",
      "##............######",
      "##..o#o.o.....#.m.##",
      "##....#.......#~####",
      "##....B........#####",
      "##...o~~s......#####",
      "############..######",
      "##................##",
      "##..............o.##",
      "#g................##",
      "##................##",
      "####################",
      "####################"
    ],
    "facing": "N",
    "mirrors": [
      {
        "at": {
          "x": 13,
          "y": 3
        },
        "facing": "NW"
      }
    ],
    "circuits": [
      {
        "id": "charge",
        "color": 10,
        "buttons": [
          {
            "x": 4,
            "y": 1
          },
          {
            "x": 16,
            "y": 16
          }
        ]
      },
      {
        "id": "optique",
        "color": 15,
        "buttons": [
          {
            "x": 14,
            "y": 1
          }
        ]
      },
      {
        "id": "chœur",
        "color": 6,
        "buttons": [
          {
            "x": 9,
            "y": 9
          },
          {
            "x": 11,
            "y": 9
          }
        ]
      },
      {
        "id": "capture",
        "color": 14,
        "buttons": [
          {
            "x": 13,
            "y": 12
          }
        ]
      }
    ],
    "gates": [
      {
        "at": {
          "x": 2,
          "y": 4
        },
        "circuit": "charge",
        "direction": "W",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 17,
          "y": 4
        },
        "circuit": "optique",
        "direction": "E",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 2,
          "y": 16
        },
        "circuit": "chœur",
        "direction": "W",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 15,
          "y": 9
        },
        "circuit": "capture",
        "direction": "S",
        "closedWhen": "pressed"
      }
    ]
  },
  {
    "id": "ss19-03",
    "title": "L’interrupteur hors d’atteinte",
    "rows": [
      "####################",
      "####################",
      "##o#####.....#..#..#",
      "##~#####.....#.#o#.#",
      "##~#####.........#.#",
      "##~#####..#..#...#.#",
      "##.~~~.#.....#..#..#",
      "########.....#...g##",
      "########B....#...#.#",
      "########.....#######",
      "########.....#######",
      "########.....#.....#",
      "########.....#....Z#",
      "########.....#.....#",
      "########W..........#",
      "########.....#.....#",
      "########.....#o.g..#",
      "#########g#..#.....#",
      "####################",
      "####################"
    ],
    "mirrors": [
      {
        "at": {
          "x": 2,
          "y": 6
        },
        "facing": "NE"
      }
    ],
    "circuits": [
      {
        "id": "alternance",
        "buttons": [
          {
            "x": 6,
            "y": 6
          }
        ],
        "color": 15
      },
      {
        "id": "charges",
        "buttons": [
          {
            "x": 10,
            "y": 4
          },
          {
            "x": 8,
            "y": 11
          }
        ],
        "color": 12
      }
    ],
    "gates": [
      {
        "at": {
          "x": 13,
          "y": 4
        },
        "circuit": "alternance",
        "direction": "W",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 13,
          "y": 14
        },
        "circuit": "alternance",
        "direction": "E",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 9,
          "y": 17
        },
        "circuit": "alternance",
        "direction": "N",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 9,
          "y": 16
        },
        "circuit": "charges",
        "direction": "N",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 17,
          "y": 7
        },
        "circuit": "charges",
        "direction": "N",
        "closedWhen": "released"
      }
    ]
  },
  {
    "id": "ss19-04",
    "title": "Le gardien de la vanne",
    "rows": [
      "####################",
      "####################",
      "##....#....~~~.....#",
      "##Woo......~~~.....#",
      "##....#.##.~~~.....#",
      "#######...B~m#...Z.#",
      "#######....#~#.....#",
      "#######....~#~.....#",
      "#######....~~~.....#",
      "#######....~~~.....#",
      "#######....~~~.....#",
      "#######....~~~.....#",
      "#######....~~~.....#",
      "#######....s~~....g#",
      "#####......~~~.....#",
      "#####g.....~~~..g..#",
      "#######....~~~.....#",
      "####################",
      "####################",
      "####################"
    ],
    "circuits": [
      {
        "id": "gardien",
        "buttons": [
          {
            "x": 12,
            "y": 5
          }
        ],
        "color": 12
      },
      {
        "id": "trappe",
        "buttons": [
          {
            "x": 17,
            "y": 5
          }
        ],
        "color": 15
      }
    ],
    "gates": [
      {
        "at": {
          "x": 6,
          "y": 3
        },
        "circuit": "gardien",
        "direction": "W",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 16,
          "y": 15
        },
        "circuit": "gardien",
        "direction": "N",
        "closedWhen": "pressed"
      }
    ],
    "platforms": [
      {
        "at": {
          "x": 12,
          "y": 6
        },
        "circuit": "trappe",
        "activeWhen": "pressed"
      }
    ]
  },
  {
    "id": "ss19-05",
    "title": "Le troisième doit rester vivant",
    "rows": [
      "####################",
      "##########W.########",
      "##########og########",
      "##########.#########",
      "#########..#########",
      "#########.##########",
      "###.#####.##########",
      "###.#####m##########",
      "###.#.###.##########",
      "###.#.#..m.........#",
      "###.#m#.........Z..#",
      "###B#.#............#",
      "###.#o#............#",
      "###.###..g.........#",
      "###................#",
      "###................#",
      "###g###............#",
      "####################",
      "####################",
      "####################"
    ],
    "circuits": [
      {
        "id": "captif",
        "buttons": [
          {
            "x": 5,
            "y": 8
          }
        ],
        "color": 12
      },
      {
        "id": "verrou",
        "buttons": [
          {
            "x": 5,
            "y": 9
          }
        ],
        "color": 14
      },
      {
        "id": "presse-ouest",
        "buttons": [
          {
            "x": 15,
            "y": 10
          }
        ],
        "color": 15
      },
      {
        "id": "presse-sud",
        "buttons": [
          {
            "x": 15,
            "y": 13
          }
        ],
        "color": 6
      },
      {
        "id": "meule",
        "buttons": [
          {
            "x": 9,
            "y": 12
          }
        ],
        "color": 10
      }
    ],
    "gates": [
      {
        "at": {
          "x": 9,
          "y": 13
        },
        "circuit": "captif",
        "direction": "E",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 10,
          "y": 3
        },
        "circuit": "captif",
        "direction": "N",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 3,
          "y": 16
        },
        "circuit": "verrou",
        "direction": "N",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 10,
          "y": 4
        },
        "circuit": "presse-ouest",
        "direction": "W",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 9,
          "y": 4
        },
        "circuit": "presse-sud",
        "direction": "S",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 9,
          "y": 6
        },
        "circuit": "presse-sud",
        "direction": "S",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 11,
          "y": 2
        },
        "circuit": "meule",
        "direction": "N",
        "closedWhen": "released"
      }
    ]
  },
  {
    "id": "ss19-06",
    "title": "La seconde image",
    "rows": [
      "####################",
      "#~~~~~~~~~~~~~~~~~~#",
      "#~~~~~~...g~~~~~~~~#",
      "#~~~~~~....~~~~~~~~#",
      "#~~~~~~....~~~~~~~~#",
      "#~~~~~~~~~~B~~~~~~~#",
      "#~~~.~~~~~~.~o~~~~~#",
      "#~~~.~~~~~~.~.~~~~~#",
      "#~~~.~~~.~..~.~~~~~#",
      "#~~~.~~~~~.~~.~~~~~#",
      "#~.....~~~..~~~~~~~#",
      "#~.....~~~..~~~~~~~#",
      "#~.W...~~~..~o~~~~~#",
      "#~.....~~~..~~~~~~~#",
      "#~.........~..~~~~~#",
      "#~.Z.......#.~~~~~~#",
      "#~.....~~~~~.....~~#",
      "#~~~~~~~~~~~..g.g~~#",
      "#~~~~~~~~~~~~~~~~~~#",
      "####################"
    ],
    "facing": "N",
    "mirrors": [
      {
        "at": {
          "x": 8,
          "y": 8
        },
        "facing": "NW"
      },
      {
        "at": {
          "x": 13,
          "y": 14
        },
        "facing": "NW"
      }
    ],
    "circuits": [
      {
        "id": "retard",
        "buttons": [
          {
            "x": 8,
            "y": 14
          }
        ],
        "color": 15
      }
    ],
    "gates": [
      {
        "at": {
          "x": 8,
          "y": 4
        },
        "circuit": "retard",
        "direction": "S",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 10,
          "y": 2
        },
        "circuit": "retard",
        "direction": "W",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 12,
          "y": 16
        },
        "circuit": "retard",
        "direction": "N",
        "closedWhen": "released"
      }
    ]
  },
  {
    "id": "ss19-07",
    "title": "Le relais condamné",
    "rows": [
      "####################",
      "#~~~~~~~~~~~~~~~~~~#",
      "#~~~~~~~~~~~~~~~~~~#",
      "#~~~~~~~~~~~~~~~~~~#",
      "#~~~~~~~~~~~~~~~~~~#",
      "#~~~~~~~~~~~~~~~~~~#",
      "#~~~~~~~~~~~~~~~~~~#",
      "#~~~~~~~~~~#~~~~~~~#",
      "#g.~~.~~g~~..~~~~~~#",
      "#~.~~.~~~~~~~~~~~~~#",
      "#~g~~.~~~~~~~~~~~~~#",
      "#~~......~~......~~#",
      "#~~.W..B.~~...om.~~#",
      "#~~......~~......~~#",
      "#~.......#~......~~#",
      "#~~......o~......~~#",
      "#~~.......~......~~#",
      "#~...Z....~~~~~~~~~#",
      "#~~~~~~~~.~~~~~~~~~#",
      "####################"
    ],
    "facing": "N",
    "mirrors": [
      {
        "at": {
          "x": 11,
          "y": 8
        },
        "facing": "SW"
      },
      {
        "at": {
          "x": 12,
          "y": 8
        },
        "facing": "SW"
      },
      {
        "at": {
          "x": 3,
          "y": 14
        },
        "facing": "NE"
      }
    ],
    "circuits": [
      {
        "id": "relais",
        "buttons": [
          {
            "x": 9,
            "y": 18
          }
        ],
        "color": 15
      },
      {
        "id": "quai",
        "buttons": [
          {
            "x": 16,
            "y": 12
          }
        ],
        "color": 10
      }
    ],
    "gates": [
      {
        "at": {
          "x": 11,
          "y": 8
        },
        "circuit": "relais",
        "direction": "N",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 1,
          "y": 8
        },
        "circuit": "quai",
        "direction": "S",
        "closedWhen": "released"
      }
    ]
  },
  {
    "id": "ss19-08",
    "title": "Les deux gardiens vivants",
    "rows": [
      "####################",
      "####################",
      "####################",
      "######....m#########",
      "######.#############",
      "####....B########o##",
      "####.#.##########~##",
      "####.#.##########m##",
      "####.....########~##",
      "#...........#####~##",
      "#...........#####~##",
      "#...........~.~~~.##",
      "#.Z..W......#.######",
      "#...........########",
      "#...........########",
      "#.......g...########",
      "#............#...###",
      "#............~g..###",
      "#.........g..#...###",
      "####################"
    ],
    "facing": "N",
    "mirrors": [
      {
        "at": {
          "x": 17,
          "y": 11
        },
        "facing": "NW"
      }
    ],
    "circuits": [
      {
        "id": "reserve",
        "buttons": [
          {
            "x": 17,
            "y": 5
          }
        ],
        "color": 10
      },
      {
        "id": "livraison",
        "buttons": [
          {
            "x": 3,
            "y": 16
          }
        ],
        "color": 14
      },
      {
        "id": "gardien-ouest",
        "buttons": [
          {
            "x": 6,
            "y": 6
          }
        ],
        "color": 15
      },
      {
        "id": "gardien-est",
        "buttons": [
          {
            "x": 13,
            "y": 12
          }
        ],
        "color": 12
      }
    ],
    "gates": [
      {
        "at": {
          "x": 11,
          "y": 11
        },
        "circuit": "reserve",
        "direction": "S",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 13,
          "y": 11
        },
        "circuit": "livraison",
        "direction": "S",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 6,
          "y": 7
        },
        "circuit": "gardien-ouest",
        "direction": "S",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 8,
          "y": 15
        },
        "circuit": "gardien-ouest",
        "direction": "W",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 10,
          "y": 18
        },
        "circuit": "gardien-est",
        "direction": "W",
        "closedWhen": "released"
      }
    ]
  }
];
