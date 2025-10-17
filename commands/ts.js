const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'ts',
    description: 'Muestra todos los Pokémon con canales bloqueados',
    async execute(client, message, args, { lockedChannels, paginationStates, generatePaginationButtons }) {
        // 1. Contar Pokémon bloqueados
        const pokemonCounts = {};
        Array.from(lockedChannels.values()).forEach(({ pokemon }) => {
            pokemonCounts[pokemon] = (pokemonCounts[pokemon] || 0) + 1;
        });

        // 2. Ordenar por cantidad
        const sortedPokemon = Object.entries(pokemonCounts).sort((a, b) => b[1] - a[1]);

        if (sortedPokemon.length === 0) {
            return message.reply('❌ No hay Pokémon bloqueados actualmente.');
        }

        // 3. Configuración de paginación
        const itemsPerPage = 10;
        const totalPages = Math.ceil(sortedPokemon.length / itemsPerPage);
        const currentPage = 0;
        const prefix = 'ts_';

        // 4. Crear embed
        const embed = new EmbedBuilder()
            .setTitle('🏆 Ranking de Pokémon Bloqueados')
            .setColor(0xFFA500)
            .setFooter({ text: `Página ${currentPage + 1}/${totalPages}` });

        // 5. Añadir campos
        const startIdx = currentPage * itemsPerPage;
        sortedPokemon.slice(startIdx, startIdx + itemsPerPage).forEach(([pokemon, count], i) => {
            const position = startIdx + i + 1;
            let emoji;
            
            if (position === 1) emoji = '👑';
            else if (position === 2) emoji = '🥈';
            else if (position === 3) emoji = '🥉';
            else if (position <= 10) emoji = '✳️';
            else emoji = '🔶';

            embed.addFields({
                name: `${emoji} \`#${position}\` **${this.formatName(pokemon)}**`,
                value: `🔒 **[ ${count} ] Spawns**\n================`,
                inline: false
            });
        });

        // 6. Enviar mensaje con botones
        const msg = await message.reply({ 
            embeds: [embed], 
            components: [generatePaginationButtons(currentPage, totalPages, prefix)],
            fetchReply: true
        });

        // 7. Guardar estado
        const state = {
            currentPage,
            totalPages,
            sortedPokemon,
            itemsPerPage,
            messageAuthorId: message.author.id,
            commandName: this.name,
            customPrefix: prefix,
            messageId: msg.id,
            timestamp: Date.now()
        };
        paginationStates.set(msg.id, state);

        // 8. Eliminar completamente los botones después de 1 minuto (60000 ms)
        setTimeout(async () => {
            if (!paginationStates.has(msg.id)) return;
            
            try {
                // Eliminar todos los componentes (botones)
                await msg.edit({ components: [] });
                paginationStates.delete(msg.id);
            } catch (error) {
                console.error('Error al eliminar botones:', error);
                paginationStates.delete(msg.id);
            }
        }, 60000);
    },

    async handlePagination(interaction, state, generatePaginationButtons, paginationStates) {
        if (!interaction.isButton()) return;

        // Verificar si la interacción ha expirado
        if (!paginationStates.has(interaction.message.id)) {
            return interaction.update({
                components: [], // Eliminar botones
                content: '⌛ Esta interacción ha expirado (1 minuto)',
                embeds: []
            }).catch(() => {});
        }

        // Verificar autor
        if (interaction.user.id !== state.messageAuthorId) {
            return interaction.reply({ 
                content: '❌ Solo el autor del comando puede interactuar.', 
                ephemeral: true 
            });
        }

        // Manejar cierre
        if (interaction.customId === `${state.customPrefix}close_list`) {
            paginationStates.delete(interaction.message.id);
            return interaction.message.delete().catch(() => 
                interaction.update({ components: [] })
            );
        }

        // Actualizar página
        let newPage = state.currentPage;
        if (interaction.customId === `${state.customPrefix}prev_page`) {
            newPage = Math.max(0, state.currentPage - 1);
        } else if (interaction.customId === `${state.customPrefix}next_page`) {
            newPage = Math.min(state.totalPages - 1, state.currentPage + 1);
        }

        // Si no hubo cambio, no hacer nada
        if (newPage === state.currentPage) return;

        // Actualizar estado
        state.currentPage = newPage;
        paginationStates.set(interaction.message.id, state);

        // Actualizar embed
        const newEmbed = new EmbedBuilder()
            .setTitle('🏆 Ranking de Pokémon Bloqueados')
            .setColor(0xFFA500)
            .setFooter({ text: `Página ${state.currentPage + 1}/${state.totalPages}` });

        const startIdx = state.currentPage * state.itemsPerPage;
        state.sortedPokemon.slice(startIdx, startIdx + state.itemsPerPage).forEach(([pokemon, count], i) => {
            const position = startIdx + i + 1;
            let emoji;
            
            if (position === 1) emoji = '👑';
            else if (position === 2) emoji = '🥈';
            else if (position === 3) emoji = '🥉';
            else if (position <= 10) emoji = '✳️';
            else emoji = '🔶';

            newEmbed.addFields({
                name: `${emoji} \`#${position}\` **${this.formatName(pokemon)}**`,
                value: `🔒 **[ ${count} ] Spawns**\n================`,
                inline: false
            });
        });

        // Actualizar mensaje
        await interaction.update({ 
            embeds: [newEmbed],
            components: [generatePaginationButtons(state.currentPage, state.totalPages, state.customPrefix)]
        }).catch(console.error);
    },

    formatName(name) {
        return name.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }
};