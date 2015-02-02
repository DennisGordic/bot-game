namespace.module('bot.entity', function (exports, require) {

    var TEAM_HERO = 0;
    var TEAM_MONSTER = 1;

    var funcs = require('org.startpad.funcs').patch();

    var log = namespace.bot.log;
    var vector = namespace.bot.vector;
    var inventory = namespace.bot.inv;
    var utils = namespace.bot.utils;
    var itemref = namespace.bot.itemref;
    var prob = namespace.bot.prob;

    var defKeys = ['strength', 'vitality', 'wisdom', 'dexterity', 'maxHp', 'maxMana', 'armor',
                   'dodge', 'eleResistAll', 'hpRegen', 'manaRegen'];
    var eleResistKeys = ['fireResist', 'coldResist', 'lightResist', 'poisResist'];
    var dmgKeys = ['physDmg', 'lightDmg', 'coldDmg', 'fireDmg', 'poisDmg', 'hpOnHit', 'hpLeech',
                   'manaOnHit', 'manaLeech', 'cooldownTime', 'range', 'speed', 'manaCost'];

    var EntitySpec = window.Model.extend({
        initialize: function() {
            this.level = 1;
            this.xp = 0;
        },

        computeAttrs: function() {
            log.error('compute attrs');
            var all = {};

            all.def = utils.newBaseStatsDict(defKeys);
            all.eleResist = utils.newBaseStatsDict(eleResistKeys);
            all.dmg = utils.newBaseStatsDict(dmgKeys); // utils.newDmgStatsDict();

            utils.addAllMods(all, this.getMods());
            // Now 'all' has the expanded trie structured mod data
            // Do final multiplication and put on the entity

            _.each(defKeys, function(stat) {
                this[stat] = utils.computeStat(all.def, stat);
            }, this);

            this.eleResistAll *= Math.pow(0.997, this.wisdom);

            // note that eleResistAll is on the def keys because of the ordering
            // added must be one, this is janky
            all.eleResist.lightResist.added = 1;
            all.eleResist.coldResist.added = 1;
            all.eleResist.fireResist.added = 1;
            all.eleResist.poisResist.added = 1;

            all.eleResist.lightResist.more *= this.eleResistAll;
            all.eleResist.coldResist.more *= this.eleResistAll;
            all.eleResist.fireResist.more *= this.eleResistAll;
            all.eleResist.poisResist.more *= this.eleResistAll;

            _.each(eleResistKeys, function(stat) {
                this[stat] = utils.computeStat(all.eleResist, stat);
            }, this);

            // Damage is left uncombined, handled in skills

            this.baseDmg = all.dmg;
            this.computeSkillAttrs();

            this.nextLevelXp = this.getNextLevelXp();
        },

        computeSkillAttrs: function() {
            this.skillchain.computeAttrs(this.baseDmg, dmgKeys);
        },

        getMods: function() {
            var mods = [
                {def: 'strength added 10', type: 'def'},
                {def: 'strength added 2 perLevel', type: 'def'},
                {def: 'dexterity added 10', type: 'def'},
                {def: 'dexterity added 2 perLevel', type: 'def'},
                {def: 'wisdom added 10', type: 'def'},
                {def: 'wisdom added 2 perLevel', type: 'def'},
                {def: 'vitality added 10', type: 'def'},
                {def: 'vitality added 2 perLevel', type: 'def'},

                {def: 'vitality gainedas 200 maxHp', type: 'def'},
                {def: 'wisdom gainedas 200 maxMana', type: 'def'},

                {def: 'strength gainedas 50 armor', type: 'def'},
                {def: 'dexterity gainedas 50 dodge', type: 'def'},
                {def: 'eleResistAll added 1', type: 'def'},

                {def: 'maxHp added 10 perLevel', type: 'def'},
                {def: 'maxMana added 5 perLevel', type: 'def'},
                //{def: 'maxHp gainedas 2 hpRegen', type: 'def'},

                //{def: 'physDmg gainedas 100 hpOnHit', type: 'dmg'},
                //{def: 'physDmg gainedas 10 hpLeech', type: 'dmg'},

                {def: 'maxMana gainedas 2 manaRegen', type: 'def'}
            ];
            return _.map(mods, function(mod) { return utils.applyPerLevel(mod, this.level); }, this);
        },

        getNextLevelXp: function() {
            return Math.floor(100 * Math.exp((this.level - 1) / Math.PI));
        },

        // TODO: memoize this
        xpOnKill: function() {
            return Math.ceil(10 * Math.pow(1.15, this.level - 1));
        }
    });

    var HeroSpec = EntitySpec.extend({
        initialize: function(name, skillchain, inv, equipped, cardInv) {
            this.name = name;
            this.skillchain = skillchain;
            this.inv = inv;
            this.cardInv = cardInv;
            this.equipped = equipped;

            EntitySpec.prototype.initialize.call(this);
            this.team = TEAM_HERO;

            log.info('HeroSpec initialize');
            this.nextAction = window.time;
            this.computeAttrs();

            // TODO, should be listening to window.ItemEvents
            // this.listenTo(window.ItemEvents, 'equipSuccess', this.computeAttrs);
            //this.listenTo(this.inv, 'equipClick', this.equipClick);
            this.listenTo(window.ItemEvents, 'equipChange', this.computeAttrs);
            this.listenTo(window.ItemEvents, 'skillchainChange', this.computeSkillAttrs);
        },

        getMods: function() {
            var mods = EntitySpec.prototype.getMods.call(this);
            return mods.concat(this.equipped.getMods());
        },

        applyXp: function(xp) {
            // TODO needs to do this to the skillchain as well
            this.equipped.applyXp(xp);
            this.skillchain.applyXp(xp);
            this.xp += xp;
            while (this.xp >= this.nextLevelXp) {
                this.level += 1;
                this.xp -= this.nextLevelXp;
                this.nextLevelXp = this.getNextLevelXp();
                this.computeAttrs();
            }
        },

        /*
        equipClick: function(item) {
            var itemType = item.itemType;
            if (itemType === 'armor') {
                this.equipped.equip(item, item.type);
            } else if (itemType === 'weapon') {
                this.equipped.equip(item, 'weapon');
            } else if (itemType === 'skill') {
                this.skillchain.add(item);
            }
        },*/
    });

    var MonsterSpec = EntitySpec.extend({

        // TODO: fn signature needs to be (name, level)
        initialize: function(name, level) {
            // All you need is a name
            EntitySpec.prototype.initialize.call(this);
            this.team = TEAM_MONSTER;
            this.name = name;
            this.level = level;

            _.extend(this, itemref.expand('monster', this.name));

            this.mods = _.map(this.items, function(item) { return utils.expandSourceItem(item[0], item[1], this.level, item[2]); }, this);
            this.mods = _.flatten(this.mods);
            this.mods = this.mods.concat(utils.expandSourceCards(this.sourceCards));

            this.droppableCards = _.filter(this.sourceCards, function(card) { if (card[0].slice(0, 5) !== 'proto') { return true; } }, this);

            this.skillchain = new inventory.Skillchain();
            for (var i = 0; i < this.skills.length; i++) {
                this.skillchain.equip(new inventory.SkillModel(this.skills[i]), i);
            }

            this.computeAttrs();
        },

        getMods: function() {
            return this.mods.concat(EntitySpec.prototype.getMods.call(this));
        },

        getDrops: function() {
            var drops = [];
            if (Math.random() < 1) { // 0.03 * 10) {
                if (this.droppableCards.length) {
                    drops.push({
                        dropType: 'card',
                        data: this.droppableCards[prob.pyRand(0, this.droppableCards.length)]
                    });
                }
            }
            if (Math.random() < 0.001 * 50) {
                if (this.items.length) {
                    var sel = this.items[prob.pyRand(0, this.items.length)];
                    drops.push({
                        dropType: sel[0],
                        data: sel
                    });
                }
            }
            if (Math.random() < 0.001 * 50) {
                if (this.skills.length) {
                    drops.push({
                        dropType: 'skill',
                        data: this.skills[prob.pyRand(0, this.skills.length)]
                    });
                }
            }
            if (drops.length > 0) {
                log.info('%s is dropping %s', this.name, JSON.stringify(drops));
            }
            return drops;
        }
    });

    function newHeroSpec(inv, cardInv) {
        // stopgap measures: basic equipped stuff
        var heroName = 'bobbeh';
        var equipped = new inventory.EquippedGearModel();
        equipped.equip(_.findWhere(inv.models, {name: 'cardboard sword'}), 'weapon');
        equipped.equip(_.findWhere(inv.models, {name: 'balsa helmet'}), 'head');

        var skillchain = new inventory.Skillchain()
        skillchain.equip(_.findWhere(inv.models, {name: 'basic melee'}), 0);

        var hero = new HeroSpec(heroName, skillchain, inv, equipped, cardInv);

        return hero;
    }

    exports.extend({
        newHeroSpec: newHeroSpec,
        MonsterSpec: MonsterSpec,
        defKeys: defKeys,
        eleResistKeys: eleResistKeys,
        dmgKeys: dmgKeys
    });

});
